# ghostdep 👻

[![CI](https://github.com/yourusername/ghostdep/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/ghostdep/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/ghostdep.svg?style=flat)](https://www.npmjs.com/package/ghostdep)
[![license](https://img.shields.io/npm/l/ghostdep.svg)](https://github.com/yourusername/ghostdep/blob/main/LICENSE)

An ultra-fast, zero-config **npm dependency scanner** and **nodejs tooling** utility to analyze, audit, and optimize your project dependencies. Instantly audit project health, calculate a dependency health score, and prune duplicate or version drift mismatches.

Use **ghostdep** to optimize your dependency tree, secure build-time scripts, and clean up your `package.json` configurations.

---

## 📖 Table of Contents
- [Introduction](#-introduction)
- [Features](#-features)
- [Installation](#-installation)
- [CLI Commands & Usage](#-cli-commands--usage)
- [Examples](#-examples)
- [Programmatic API](#-programmatic-api)
- [FAQ](#-faq)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 Introduction

In modern Node.js and TypeScript codebases, dependencies can rapidly drift. Issues like **ghost dependencies** (importing packages in your code that are not declared in `package.json`) and **unused dependencies** (packages declared but never actually used) bloat lockfiles, slow down installation times, and cause runtime crashes in containerized/production environments.

`ghostdep` resolves these problems by scanning your source code, comparing actual imports with your `package.json` declarations, walking the `node_modules` hierarchy, and calculating a precise **dependency health score**.

---

## ✨ Features

- 👻 **Ghost Dependency Detection**: Identify packages installed in `node_modules` and used in code, but missing from `package.json`.
- 🧟 **Zombie Dependency Detection**: Spot **unused dependencies** that are declared but never imported or required in your codebase.
- 📦 **Duplicate Package Finder**: Scan the active node_modules tree (with full PNPM symlink cycle protection) to identify package bloat from multiple resolved versions.
- 🔄 **Version Drift Auditing**: Compare declared semver ranges in `package.json` with actual installed versions to trace major, minor, or patch drifts.
- 📊 **Dependency Health Score**: Get an automated quality grade (A-F) based on customizable penalties.
- ⚡ **TS Compiler AST Parser**: Scans code utilizing the TypeScript Compiler API for ESM imports/exports, dynamic imports, and CommonJS require statements.

---

## 🚀 Installation

Install globally to use the CLI anywhere:

```bash
npm install -g ghostdep
```

Or install locally in your project:

```bash
npm install --save-dev ghostdep
```

---

## 💻 CLI Commands & Usage

Run the scanner directly from your project folder:

```bash
npx ghostdep
```

### Options

```
Usage: ghostdep [options] [command]

Audit Node.js/TypeScript projects for ghost, zombie, duplicate, and drifted dependencies.

Options:
  -V, --version       output the version number
  -d, --cwd <path>    Working directory of the target project (default: current directory)
  --include-dev       Include devDependencies in analysis checks (default: false)
  --include <patterns> Comma-separated glob patterns of source files to include
  --exclude <patterns> Comma-separated glob patterns of source files to ignore
  -h, --help          display help for command

Commands:
  scan                Scan project dependencies and print a detailed console report (default)
  json                Scan project dependencies and output a raw JSON report
  health              Scan project dependencies and print only the health score & grade summary
  help [command]      display help for command
```

---

## 📝 Examples

### Pretty Report Output
To execute a standard audit scan in the current directory and display a clean terminal report:
```bash
npx ghostdep scan
```

### CI/CD Automation (JSON Output)
To capture a full structured JSON report file for logging or build pipeline consumption:
```bash
npx ghostdep json > report.json
```

### Quick Score Summary
To query just the final computed health grade of the codebase:
```bash
npx ghostdep health
# Output: Health Score: 95/100 (A)
```

---

## ⚙️ Programmatic API

You can import `ghostdep` directly into your Node.js/TypeScript scripts:

```typescript
import { runScan } from 'ghostdep';

async function audit() {
  const report = await runScan({
    cwd: '/path/to/project',
    includeDev: true,
    exclude: ['**/test/**', '**/dist/**']
  });

  console.log(`Project: ${report.project.name} (v${report.project.version})`);
  console.log(`Overall Score: ${report.health.score}% (${report.health.grade})`);
  
  if (report.ghosts.length > 0) {
    console.log('Detected Ghost dependencies:', report.ghosts.map(g => g.name));
  }
}

audit();
```

---

## ❓ FAQ

### What are "Ghost Dependencies"?
Ghost dependencies are packages that your code imports (e.g. `import axios from 'axios'`), but which are not listed in your `package.json` dependencies. This often happens because the package is installed transitively by another dependency, meaning your code works locally but will fail when deployed or run in environments with flat node_modules trees.

### What are "Zombie Dependencies"?
Zombie dependencies are the opposite: they are listed in your `package.json` file but are never imported or required in your codebase. These waste disk space, slow down `npm install` times, and create security/maintenance overhead.

### Does it support PNPM and Yarn?
Yes! `ghostdep` implements a symlink-resolving walk algorithm that successfully navigates PNPM virtual stores (`.pnpm`) and Yarn workspaces without infinite loops or duplicate evaluation of symlinks.

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:
1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

Make sure to run formatting and test suites before committing:
```bash
npm run format
npm run lint
npm test
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
