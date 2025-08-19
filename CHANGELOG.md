# Changelog

All notable changes to the On-Premise LLM OpenWebUI Assistant extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.3] - 2025-08-19

### Added

- Build script for copying webview files to output directory during packaging
- Optimized `.vscodeignore` to exclude unnecessary files from packaged extension
- Added `.npmrc` for creating standardized commit messages for each release
- Add logger configuration for both developer and end-user

### Changed

- Extension name shortened from `on-premise-llm-openwebui-assistant` to `on-prem-llm-assistant` for better usability
- Updated `.gitignore` for improved development workflow

### Fixed

- Critical packaging bug: Fixed hardcoded `src/` paths to use `out/` folder for packaged extension compatibility
- Webview resource loading now works correctly in both development (F5) and packaged (.vsix) environments
  - Webview files now correctly copied to out/webview/ during build process
- Extension now properly loads HTML, CSS, and JavaScript files when installed from .vsix package
- Add missing logging level filtering for `src/services/logger.ts`

## [0.5.2] - 2025-08-18

### Added
- More logging for developer using ExtensionLogger in `src/services/logger.ts`

### Changed
- Export EXTENSION_ID variable overall

## [0.5.1] - 2025-08-18

### Fixed
- Fixed major bug to actually have the chosen model used for prompting

## [0.5.0] - 2025-08-15

### Added
- Three-mode chat system with distinct behaviors:
  - **Quick Prompt**: Truly stateless mode with no conversation memory
  - **Quick Chat**: Session-only memory that persists during VSCode session
  - **Saved Chat**: Workspace persistence with `.vscode-chat-history.json` file
- Export functionality for both Quick Chat and Saved Chat modes
- Workspace-based file persistence for Saved Chat conversations
- Functional programming refactoring with pure functions for configuration
- Domain-specific project structure with `config/` and `services/` folders

### Changed
- Migrated from OOP `ConfigManager` class to pure functions (`getExistingConfig`, `promptUserForConfig`, `ensureValidConfig`)
- Reorganized project structure from `utils/` to domain-specific folders
- Export files now default to workspace folder instead of system root
- Improved debug logging with proper object serialization
- Enhanced clear functionality with proper chat type routing

### Fixed
- Quick Chat session memory now persists when webview is closed/reopened
- Clear button functionality now works correctly for all chat modes
- Export location properly defaults to current workspace
- Conversation history no longer persists in VSCode global state for Saved Chat
- Fix Export function for QuickChat and Saved Chat

### Removed
- Hidden global state persistence in favor of transparent workspace files
- Obsolete `clearConversationHistory()` function from persistence manager

## [0.4.0] - 2025-08-13

### Added
- Clear button and clear function to WebView interface
- Status bar notification during extension startup
- Comprehensive documentation for webview files
- Separate file organization for CSS, JavaScript, and HTML

### Changed
- Replaced information message with status bar during startup
- Moved JavaScript and CSS into dedicated webview files
- Improved project file organization with proper file types

## [0.3.1] - 2025-08-13

### Fixed
- Corrected typo in README.md and removed placeholder content

## [0.3.0] - 2025-08-12

### Added
- System prompt functionality for chat conversations
- Comprehensive docstrings for all functions in the extension
- Explicit TypeScript type definitions for better code safety

### Changed
- Enhanced chat functionality with configurable system prompts
- Improved code documentation across all modules

## [0.2.0] - 2025-08-12

### Added
- Model selection dropdown with dynamic loading from OpenWebUI API
- Refresh button with animated loading indicator for model fetching
- @vscode/webview-ui-toolkit for enhanced WebView development
- Frontend model selection interface
- Backend support for loading and updating available models

### Changed
- Enhanced frontend with native VSCode UI components
- Improved message validation and error handling
- Updated TypeScript configuration with explicit types

### Fixed
- Corrected indentation for 'sendMessage' case in message handling

## [0.1.0] - 2025-08-12

### Added
- Initial VSCode extension scaffold with TypeScript support
- WebView-based chat interface with OpenWebUI integration
- Configuration management for OpenWebUI URL, API key, and default model
- OpenWebUI API service with HTTP client using Node.js built-in modules
- Basic chat functionality with message sending and receiving
- VSCode settings integration for extension configuration
- Extension packaging and development workflow setup

### Changed
- Replaced Axios dependency with Node.js built-in HTTP requests for better compatibility
- Enhanced WebView panel with proper chat interface

### Security
- Implemented secure API key handling with password input masking

---

## Development Notes

### Project Evolution
```
v0.5.0: Three-mode system with functional programming refactor
v0.4.0: Added clear functionality and file organization
v0.3.0: Added system prompts and documentation
v0.2.0: Enhanced UI with model selection
v0.1.0: Basic extension with utils/
```