import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Session } from "../src/session.js";
import { sleep, PS_PROMPT_PATTERN, PWSH_COMMAND } from "./setup.js";

describe("PowerShell Integration", () => {
  let session: Session;

  beforeEach(async () => {
    session = new Session("ps-test", {
      command: PWSH_COMMAND,
      args: ["-NoProfile", "-NoLogo"],
    });
    // Wait for prompt to be ready
    await session.waitForContent(PS_PROMPT_PATTERN);
  });

  afterEach(() => {
    if (session) {
      try {
        session.close();
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe("Basic Operations", () => {
    it("P01: shows PS prompt on startup", () => {
      const snap = session.getSnapshot();
      expect(snap.content).toMatch(PS_PROMPT_PATTERN);
    });

    it("P02: Write-Host output captured", async () => {
      session.sendKeys('Write-Host "HELLO123"');
      session.sendKeys("Enter");
      // Wait for the actual output to appear
      await session.waitForContent("HELLO123");

      const snap = session.getSnapshot();
      expect(snap.content).toContain("HELLO123");
    });

    it("P03: Get-Date output captured", async () => {
      session.sendKeys('Get-Date -Format "yyyy"');
      session.sendKeys("Enter");
      // Wait for a 4-digit year to appear
      await session.waitForContent(/202\d/);

      const snap = session.getSnapshot();
      expect(snap.content).toMatch(/202\d/);
    });

    it("P04: Multi-line output (Get-Process)", async () => {
      session.sendKeys("Get-Process | Select-Object Name, Id -First 3 | Format-Table");
      session.sendKeys("Enter");
      // Wait for table header "Name" to appear
      await session.waitForContent(/Name\s+Id/);

      const snap = session.getSnapshot();
      expect(snap.content).toMatch(/Name\s+Id/);
    });

    it("P05: Command history with Up arrow", async () => {
      // Send a command
      session.sendKeys('Write-Host "FIRST"');
      session.sendKeys("Enter");
      await session.waitForContent("FIRST");

      // Send another command
      session.sendKeys('Write-Host "SECOND"');
      session.sendKeys("Enter");
      await session.waitForContent("SECOND");

      // Wait for new prompt
      await sleep(300);

      // Press Up to get previous command
      session.sendKeys("Up");
      await sleep(200);

      const snap = session.getSnapshot();
      expect(snap.content).toContain("SECOND");
    });
  });

  describe("Interactive Prompts", () => {
    it("P06: Read-Host shows prompt", async () => {
      session.sendKeys('$name = Read-Host "Enter name"');
      session.sendKeys("Enter");
      await session.waitForContent("Enter name");

      const snap = session.getSnapshot();
      expect(snap.content).toContain("Enter name");
    });

    it("P07: Read-Host captures response", async () => {
      session.sendKeys('$name = Read-Host "Enter name"');
      session.sendKeys("Enter");
      await session.waitForContent("Enter name");

      // Send response
      session.sendKeys("TestUser");
      session.sendKeys("Enter");
      // Wait for prompt to return
      await session.waitForContent(PS_PROMPT_PATTERN);

      // Verify it captured
      session.sendKeys('Write-Host "Got: $name"');
      session.sendKeys("Enter");
      await session.waitForContent("Got: TestUser");

      const snap = session.getSnapshot();
      expect(snap.content).toContain("Got: TestUser");
    });

    it("P08: Read-Host -AsSecureString hides input", async () => {
      session.sendKeys('$pwd = Read-Host "Password" -AsSecureString');
      session.sendKeys("Enter");
      await session.waitForContent("Password");

      // Type password (won't echo)
      session.sendKeys("secret123");
      session.sendKeys("Enter");
      // Wait for prompt to return
      await session.waitForContent(PS_PROMPT_PATTERN);

      const snap = session.getSnapshot();
      // Password should not be visible
      expect(snap.content).not.toContain("secret123");
      expect(snap.content).toMatch(PS_PROMPT_PATTERN);
    });

    it("P09: Confirm prompt shows options", async () => {
      // Create a temp file first
      session.sendKeys("$tmp = New-TemporaryFile");
      session.sendKeys("Enter");
      await session.waitForContent(PS_PROMPT_PATTERN);

      session.sendKeys('Remove-Item $tmp.FullName -Confirm');
      session.sendKeys("Enter");
      // Wait for confirmation prompt
      await sleep(500);

      const snap = session.getSnapshot();
      expect(snap.content.length).toBeGreaterThan(0);
    });

    it("P10: Can respond to confirm prompt", async () => {
      // Create a temp file to delete
      session.sendKeys("$tmp = New-TemporaryFile");
      session.sendKeys("Enter");
      await session.waitForContent(PS_PROMPT_PATTERN);

      session.sendKeys('Remove-Item $tmp.FullName -Confirm');
      session.sendKeys("Enter");
      await sleep(500);

      // Send 'n' to cancel
      session.sendKeys("n");
      session.sendKeys("Enter");
      // Wait for prompt to return
      await session.waitForContent(PS_PROMPT_PATTERN);

      const snap = session.getSnapshot();
      expect(snap.content).toMatch(PS_PROMPT_PATTERN);
    });
  });

  describe("Interrupt Handling", () => {
    it("P11: Ctrl+C stops Start-Sleep", async () => {
      session.sendKeys("Start-Sleep -Seconds 30");
      session.sendKeys("Enter");
      await sleep(500); // Let it start

      // Send Ctrl+C
      session.sendKeys("c", { ctrl: true });
      // Wait for prompt to return
      await session.waitForContent(PS_PROMPT_PATTERN, { timeout: 3000 });

      const snap = session.getSnapshot();
      expect(snap.content).toMatch(PS_PROMPT_PATTERN);
    });

    it("P12: Ctrl+C stops infinite loop", async () => {
      session.sendKeys("while($true) { Start-Sleep -Milliseconds 100 }");
      session.sendKeys("Enter");
      await sleep(500); // Let it start

      // Send Ctrl+C
      session.sendKeys("c", { ctrl: true });
      // Wait for prompt to return
      await session.waitForContent(PS_PROMPT_PATTERN, { timeout: 3000 });

      const snap = session.getSnapshot();
      expect(snap.content).toMatch(PS_PROMPT_PATTERN);
    });
  });

  describe("Error Handling", () => {
    it("P13: Error output captured", async () => {
      session.sendKeys('Get-Item "C:\\this\\does\\not\\exist"');
      session.sendKeys("Enter");
      // Wait for error message
      await session.waitForContent(/Cannot find path|does not exist/i);

      const snap = session.getSnapshot();
      expect(snap.content).toMatch(/Cannot find path|ItemNotFoundException|does not exist/i);
    });

    it("P14: Continues after error", async () => {
      session.sendKeys('Get-Item "C:\\nonexistent"');
      session.sendKeys("Enter");
      // Wait for error
      await session.waitForContent(/Cannot find path|does not exist/i);

      // Should still work
      session.sendKeys('Write-Host "StillWorking"');
      session.sendKeys("Enter");
      await session.waitForContent("StillWorking");

      const snap = session.getSnapshot();
      expect(snap.content).toContain("StillWorking");
    });

    it("P15: Throw captured", async () => {
      session.sendKeys('throw "TestError"');
      session.sendKeys("Enter");
      await session.waitForContent("TestError");

      const snap = session.getSnapshot();
      expect(snap.content).toContain("TestError");
    });
  });

  describe("Special Characters", () => {
    it("P16: Path with spaces", async () => {
      session.sendKeys('Write-Host "C:\\Program Files\\test"');
      session.sendKeys("Enter");
      await session.waitForContent("C:\\Program Files\\test");

      const snap = session.getSnapshot();
      expect(snap.content).toContain("C:\\Program Files\\test");
    });

    it("P17: Pipeline works", async () => {
      session.sendKeys("1..3 | ForEach-Object { $_ * 2 }");
      session.sendKeys("Enter");
      // Wait for the output
      await session.waitForContent("6");

      const snap = session.getSnapshot();
      expect(snap.content).toContain("2");
      expect(snap.content).toContain("4");
      expect(snap.content).toContain("6");
    });

    it("P18: Variables persist", async () => {
      session.sendKeys("$testVar = 123");
      session.sendKeys("Enter");
      await session.waitForContent(PS_PROMPT_PATTERN);

      session.sendKeys("Write-Host $testVar");
      session.sendKeys("Enter");
      await session.waitForContent("123");

      const snap = session.getSnapshot();
      expect(snap.content).toContain("123");
    });

    it("P19: Here-string works", async () => {
      session.sendKeys("$text = @'");
      session.sendKeys("Enter");
      session.sendKeys("Line1");
      session.sendKeys("Enter");
      session.sendKeys("Line2");
      session.sendKeys("Enter");
      session.sendKeys("'@");
      session.sendKeys("Enter");
      await session.waitForContent(PS_PROMPT_PATTERN);

      session.sendKeys("$text");
      session.sendKeys("Enter");
      await session.waitForContent("Line1");

      const snap = session.getSnapshot();
      expect(snap.content).toContain("Line1");
      expect(snap.content).toContain("Line2");
    });
  });
});

describe("PSRP / Remoting (Local)", () => {
  let session: Session;

  beforeEach(async () => {
    session = new Session("psrp-test", {
      command: PWSH_COMMAND,
      args: ["-NoProfile", "-NoLogo"],
    });
    await session.waitForContent(PS_PROMPT_PATTERN);
  });

  afterEach(() => {
    if (session) {
      try {
        session.close();
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it("R01: Invoke-Command local works", async () => {
    session.sendKeys('Invoke-Command -ScriptBlock { "REMOTETEST" }');
    session.sendKeys("Enter");
    await session.waitForContent("REMOTETEST");

    const snap = session.getSnapshot();
    expect(snap.content).toContain("REMOTETEST");
  });

  it("R02: Test-WSMan localhost", async () => {
    session.sendKeys("Test-WSMan -ComputerName localhost -ErrorAction SilentlyContinue");
    session.sendKeys("Enter");
    // Wait for response (either WSMan info or error)
    await sleep(1000);

    const snap = session.getSnapshot();
    // Either shows WSMan info or just returns to prompt
    expect(snap.content).toMatch(/wsmid|PS [A-Z]:\\.*>/i);
  });
});
