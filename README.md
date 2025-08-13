# on-premise-llm-openwebui-chat README

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
npm install -g yo generator-code @vscode/vsce

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

# For easy WebView development
npm install @vscode/webview-ui-toolkit 

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
