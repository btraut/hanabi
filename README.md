# Lost in Translation

pictionary + telephone
best played in groups with alcohol

## Development environment

Components are built using [TypeScript](https://www.typescriptlang.org/) and [webpack](https://webpack.github.io/). All styles are written using [LESS](http://lesscss.org/).

### Pre-Installation

Before setting up your environment, you must have a few things installed:

1. **node.js**, version 7.x or greater – Can be installed from [npmjs.com](https://www.npmjs.com/), but I prefer using [Homebrew](https://brew.sh/). Version 7.x is required in order to leverage greater ES6/ES7 support.
2. **npm** - Usually installed with node.js.
3. **yarn** - Not required, but works much better than npm for installing dependencies. [Installation instructions](https://yarnpkg.com/en/docs/install) recommend Homebrew installation.

### Installation

These instructions assume you’ve already cloned the master branch.

#### Building Code

The way you build code for web, background-worker, and scheduler is all the same:

1. Navigate to the appropriate folder, `<root>/web` for example, in a command prompt.
2. Run `yarn` to install dependencies.
3. Run `yarn run watch` to launch a daemon that builds code any time changes are made.

#### Environment Variables

To keep login credentials and other app secrets out of the git repository, Lost in Translation uses `process.env` variables at runtime to access credentials. It’s easiest in a development environment to define these credentials ahead of time:

1. In the root lost-in-translation folder, copy the `.env.sample` file and name the copy `.env`.
2. Open the `.env` file and change any/all of the values to real credentials.
3. At runtime, Lost in Translation will check if `.env` exists and will load all environment variables from it.

Note that `.env` is ignored by git, so you run no risk of committing sensetive information.

### Serving Locally

#### *Web Server*

Once web is built, you can use node.js to host them locally:

1. Navigate to `<root>/web` in a command prompt.
2. Run `yarn run serve` to launch a local HTTP server. Any time web code is rebuilt, this server will automatically relaunch.

It is recommended that, during active development, you run `yarn run watch` in the web directory in addition to running the server. That way, when source files are changed, they are rebuilt and the server will automatically restart.

### Deploying

(work in progress)

### Visual Studio Code

While you can use any text editor that you like to develop, I recommend [Visual Studio Code](http://code.visualstudio.com/) for greatest compatibility with TypeScript.

VS Code works great out of the box and detects everything it needs based on the project’s directory structure.

#### TypeScript Versions

VS Code embeds its own version of TypeScript that is often updated on a different schedule than Lost in Translation’s updates. To sync development, VS Code allows developers to specify their own TypeScript package. To enable this, follow the [“Using Newer TypeScript Versions” instructions](https://code.visualstudio.com/docs/languages/typescript#_using-newer-typescript-versions).

## Debugging

The best way I’ve found to debug server code locally is to use Visual Studio Code’s built-in node.js debugger. It isn’t a perfect solution, and it’s made harder because Babel is transforming and bundling the code that gets executed, although sourcemaps help tell Visual Studio Code how to map the code back to source.

1. If you’re currently running the server in a command prompt (via `yarn run serve`), kill the proccess.
2. Open the project in Visual Studio Code.
3. Click the Debug tab on the main navigation (`⌘⇧D`).
4. Click the green Play icon. The server should now start up.
5. Add `debugger;` lines or click in the margins of the code to add breakpoints.
6. Execute the code. Use breakpoints, the Variables/Watch/Call Stack panels, and the developer console to debug.

After any changes to the code, the debugger must re-launch the server. Use the Restart button on the floating debugger toolbar (`⌘⇧F5`) to re-launch.