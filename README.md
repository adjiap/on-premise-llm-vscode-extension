# on-premise-llm-openwebui-chat README

This is the README for your extension "on-premise-llm-openwebui-chat". After writing up a brief description, we recommend including the following sections.

## Features

Describe specific features of your extension including screenshots of your extension in action. Image paths are relative to this README file.

For example if there is an image subfolder under your extension project workspace:

\!\[feature X\]\(images/feature-x.png\)

> Tip: Many popular extensions utilize animations. This is an excellent way to show off your extension! We recommend short, focused animations that are easy to follow.

## Requirements

If you have any requirements or dependencies, add a section describing those and how to install and configure them.

## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `myExtension.enable`: Enable/disable this extension.
* `myExtension.thing`: Set to `blah` to do something.

## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.

## Release Notes

Users appreciate release notes as you update your extension.

### 1.0.0

Initial release of ...

### 1.0.1

Fixed issue #.

### 1.1.0

Added features X, Y, and Z.

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

## Developer Setup

### Prerequisites (based on what I used to develop it)
- Windows 11 with WSL2 installed
- Ubuntu 24.04 LTS running in WSL
- VSCode with WSL extension installed
- Access to running Ollama + OpenWebUI instance, see the setup in [here](https://github.com/adjiap/on-premise-llm-infrastructure-setup) and how to access it in [here](https://github.com/adjiap/local-ollama-powershell-wrapper-api)

> [!TIP]
> Test the connectivity by doing so:
> 
> ```sh
> # Set environment variables (adjust URL and API key as needed)
> export OPENWEBUI_URL_WITH_TAGS="http://localhost:3000/ollama/api/tags"
> export OPENWEBUI_API_KEY="your_api_key_here"
>
> # Test API connectivity
> curl -H "Authorization: Bearer > $OPENWEBUI_API_KEY" \
>     $OPENWEBUI_URL_WITH_TAGS
> ```


### Environment Setup

#### 1. Node.js Installation (WSL Ubuntu)

```bash
# Update package list
sudo apt update

# Install Node.js LTS via NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

node --version # NodeJS 22.x and above
npm --version  # npm 10.x and above
```

#### 2. Install VSCode Extension generator tools

```sh
npm install -g yo generatoc-code @vscode/vsce

yo --version # yo 5.x and above
```

#### 2.5. (Optional, when starting from scratch) Extension Project Setup

```sh
# Generate new VSCode extension
yo code

# Select: "New Extension (TypeScript)"
# Follow prompts for extension name and details
# 

# Navigate to project directory
cd on-premise-llm-openwebui-chat

# Fix VSCode types version (if needed, because somehow I got an error if I didn't)
# Edit package.json and change "@types/vscode" from "^1.103.0" to "^1.85.0"
# Also update "engines.vscode" to "^1.85.0"

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Optional: Run in watch mode for automatic compilation
npm run watch
```

#### 3. React Dependencies (for Chat UI)

```sh
# Install React and build tools
npm install react react-dom
npm install -D @types/react @types/react-dom webpack webpack-cli css-loader style-loader ts-loader html-webpack-plugin
```

## Developer workflow

> [!TIP]
> Whenever you run development session, have autocompile on
> ```sh
> npm run watch
> ```

### 1. Pre-Release Preparation

```sh
# 1. Stop autocompile (Ctrl+C)

# 2. Compile everything
npm run compile

# 3. Check Typescript/Lint
npm run lint

# 4. Run tests
npm test
```

### 2. Version Changes

```sh
npm version patch   # 0.1.0 -> 0.1.1 (bug fixes)
npm version minor   # 0.1.0 -> 0.2.0 (new features)
npm version major   # 0.1.0 -> 1.0.0 (breaking changes)
```

### 3. Git package and release

```sh
git add `<name-of-files>`
git commit -m "commit message"
# Because we versioned using `npm version minor` or others, we can run this.
git push origin <branch-name> --follow-tags 
```

## Developer Packaging & Install

Once you're ready to package the extension, run this:

```sh
# Compile everything first
npm run compile

# Package it 
npx vsce package
# You'll get something like `on-premise-llm-openwebui-chat-0.0.1.vsix`
```

And install/deinstall it using

```sh
# Install
code --install-extension on-premise-llm-openwebui-chat-0.0.1.vsix

# Uninstall
code --uninstall-extension adjiap.on-premise-llm-openwebui-chat
```

**Enjoy!**
