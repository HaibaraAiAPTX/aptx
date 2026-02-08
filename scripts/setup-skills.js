#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const sourceDir = path.join(projectRoot, "skills");
const agentsSkillsDir = path.join(projectRoot, ".agents", "skills");
const claudeSkillsDir = path.join(projectRoot, ".claude", "skills");

if (!fs.existsSync(sourceDir)) {
  console.error(`Error: Source directory '${sourceDir}' does not exist`);
  process.exit(1);
}

fs.mkdirSync(agentsSkillsDir, { recursive: true });
fs.mkdirSync(claudeSkillsDir, { recursive: true });

console.log(
  `Symlinking skills from '${sourceDir}' to '${agentsSkillsDir}' and '${claudeSkillsDir}'...`,
);

function createSymlinks(targetDir) {
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const skillName = entry.name;
      const skillDir = path.join(sourceDir, skillName);
      const symlinkPath = path.join(targetDir, skillName);

      try {
        if (
          fs.existsSync(symlinkPath) ||
          fs.lstatSync(symlinkPath).isSymbolicLink()
        ) {
          console.log(`Removing existing: ${symlinkPath}`);
          fs.rmSync(symlinkPath, { recursive: true, force: true });
        }
      } catch {
        if (fs.existsSync(symlinkPath)) {
          console.log(`Removing existing: ${symlinkPath}`);
          fs.rmSync(symlinkPath, { recursive: true, force: true });
        }
      }

      console.log(`Creating symlink: ${symlinkPath} -> ${skillDir}`);
      try {
        fs.symlinkSync(skillDir, symlinkPath, "dir");
      } catch (error) {
        if (error.code === "EPERM" && process.platform === "win32") {
          console.error(
            `  Error: Administrator privileges required to create symbolic links on Windows`,
          );
          console.error(
            `  Alternatively, run PowerShell as Administrator and execute: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`,
          );
        } else {
          console.error(`  Error creating symlink: ${error.message}`);
        }
      }
    }
  }
}

console.log("");
console.log("Creating symlinks in .agents/skills...");
createSymlinks(agentsSkillsDir);

console.log("");
console.log("Creating symlinks in .claude/skills...");
createSymlinks(claudeSkillsDir);

console.log("");
console.log("Done! Skills have been symlinked.");
console.log("");
console.log("Symlinks created:");
console.log(fs.readdirSync(agentsSkillsDir).join("\n"));
console.log("");
console.log(fs.readdirSync(claudeSkillsDir).join("\n"));
