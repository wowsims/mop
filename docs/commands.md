# Commands
We use a makefile for our build system. These commands will usually be all you need while developing for this project:
```sh
# Installs a pre-commit git hook so that your go code is automatically formatted (if you don't use an IDE that supports that).  If you want to manually format go code you can run make fmt.
# Also installs `air` to reload the dev servers automatically
make setup

# Run all the tests. Currently only the backend sim has tests.
make test

# Update the expected test results. This will need to be run after adding/removing any tests, and also if test results change due to code changes.
make update-tests

# Host a local version of the UI at http://localhost:8080. Visit it by pointing a browser to
# http://localhost:8080/mop/YOUR_SPEC_HERE, where YOUR_SPEC_HERE is the directory under ui/ with your custom code.
# Recompiles the entire client before launching using `make dist/mop`
make host

# With file-watching so the server auto-restarts and recompiles on Go or TS changes:
WATCH=1 make host

# Delete all generated files (.pb.go and .ts proto files, and dist/)
make clean

# Recompiles the ts only for the given spec (e.g. make host_elemental_shaman)
make host_$spec

# Recompiles the `wowsimmop` server binary and runs it, hosting /dist directory at http://localhost:3333/mop.
# This is the fastest way to iterate on core go simulator code so you don't have to wait for client rebuilds.
# To rebuild client for a spec just do 'make $spec' and refresh browser.
make rundevserver

# With file-watching so the server auto-restarts and recompiles on Go or TS changes:
WATCH=1 make rundevserver

# The same as rundevserver, recompiles  `wowsimmop` binary and runs it on port 3333. Instead of serving content from the dist folder,
# this command also runs `vite serve` to start the Vite dev server on port 5173 (or similar) and automatically reloads the page on .ts changes in less than a second.
# This allows for more rapid development, with sub second reloads on TS changes. This combines the benefits of `WATCH=1 make rundevserver` and `WATCH=1 make host`
# to create something that allows you to work in any part of the code with ease and speed.
# This might get rolled into `WATCH=1 make rundevserver` at some point.
WATCH=1 make devmode

# This is just the same as rundevserver currently
make devmode

# This command recompiles the workers in the /ui/worker folder for easier debugging/development
# Can be used with or without WATCH command
make webworkers

# With file watch enabled
WATCH=1 make webworkers

# Creates the 'wowsimmop' binary that can host the UI and run simulations natively (instead of with wasm).
# Builds the UI and the compiles it into the binary so that you can host the sim as a server instead of wasm on the client.
# It does this by first doing make dist/mop and then copying all those files to binary_dist/mop and loading all the files in that directory into its binary on compile.
make wowsimmop

# Using the --usefs flag will instead of hosting the client built into the binary, it will host whatever code is found in the /dist directory.
# Use --wasm to host the client with the wasm simulator.
# The server also disables all caching so that refreshes should pickup any changed files in dist/. The client will still call to the server to run simulations so you can iterate more quickly on client changes.
# make dist/mop && ./wowsimmop --usefs would rebuild the whole client and host it. (you would have had to run `make devserver` to build the wowsimmop binary first.)
./wowsimmop --usefs

# Generate code for the sim database (db.json). Only necessary if you changed the items generator.
# Useful only if you're actively working on the generator and have already run make db locally at least once.
make simdb

# Generate data from WoW client files
# Requires dotnet 9 to run
# Uses tools/database/generator-settings.json for settings
# Also runs make simdb
# This is what you will use most of the time for generation
make db

# Same as make db but from the ptr client
# Uses tools/database/ptr-generator-settings.json for settings
make ptrdb
```
