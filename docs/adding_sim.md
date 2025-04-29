# Adding a Sim
So you want to make a new sim for your class/spec! The basic steps are as follows:
 - [Create the proto interface between sim and UI.](#create-the-proto-interface-between-sim-and-ui)
 - [Implement the UI.](#implement-the-ui)
 - [Implement the sim.](#implement-the-sim)
 - [Launch the site.](#launch-the-site)


## Create the proto interface between Sim and UI
This project uses [Google Protocol Buffers](https://developers.google.com/protocol-buffers/docs/gotutorial "https://developers.google.com/protocol-buffers/docs/gotutorial") to pass data between the sim and the UI. TLDR; Describe data structures in .proto files, and the tool can generate code in any programming language. It lets us avoid repeating the same code in our Go and Typescript worlds without losing type safety.

For a new sim, make the following changes:
  - Add a new value to the `Spec` enum in proto/common.proto. __NOTE: The name you give to this enum value is not just a name, it is used in our templating system. This guide will refer to this name as `$SPEC` elsewhere.__
  - Add a 'proto/YOUR_CLASS.proto' file if it doesn't already exist and add data messages containing all the class/spec-specific information needed to run your sim.
  - Update the `PlayerOptions.spec` field in `proto/api.proto` to include your shiny new message as an option.

That's it! Now when you run `make` there will be generated .go and .ts code in `sim/core/proto` and `ui/core/proto` respectively. If you aren't familiar with protos, take a quick look at them to see what's happening.

## Implement the UI
The UI and sim can be done in either order, but it is generally recommended to build the UI first because it can help with debugging. The UI is very generalized and it doesn't take much work to build an entire sim UI using our templating system. To use it:
  - Modify `ui/core/proto_utils/utils.ts` to include boilerplate for your `$SPEC` name if it isn't already there.
  - Create a directory `ui/$SPEC`. So if your Spec enum value was named, `elemental_shaman`, create a directory, `ui/elemental_shaman`.
  - Copy+paste from another spec's UI code.
  - Modify all the files for your spec; most of the settings are fairly obvious, if you need anything complex just ask and we can help!
  - Finally, add a rule to the `makefile` for the new sim site. Just copy from the other site rules already there and change the `$SPEC` names.

No .html is needed, it will be generated based on `ui/index_template.html` and the `$SPEC` name.

When you're ready to try out the site, run `make host` and navigate to `http://localhost:8080/mop/$SPEC`.

## Implement the Sim
This step is where most of the magic happens. A few highlights to start understanding the sim code:
  - `sim/wasm/main.go` This file is the actual main function, for the [.wasm binary](https://webassembly.org/ "https://webassembly.org/") used by the UI. You shouldn't ever need to touch this, but just know its here.
  - `sim/core/api.go` This is where the action starts. This file implements the request/response messages defined in `proto/api.proto`.
  - `sim/core/sim.go` Orchestrates everything. Main event loop is in `Simulation.RunOnce`.
  - `sim/core/agent.go` An Agent can be thought of as the 'Player', i.e. the person controlling the game. This is the interface you'll be implementing.
  - `sim/core/character.go` A Character holds all the stats/cooldowns/gear/etc common to any WoW character. Each Agent has a Character that it controls.

Read through the core code and some examples from other classes/specs to get a feel for what's needed. Hopefully `sim/core` already includes what you need, but most classes have at least 1 unique mechanic so you may need to touch `core` as well.

Finally, add your new sim to `RegisterAll()` in `sim/register_all.go`.

Don't forget to write unit tests! Again, look at existing tests for examples. Run them with `make test` when you're ready.

# Launch the site
When everything is ready for release, modify `ui/core/launched_sims.ts` and `ui/index.html` to include the new spec value. This will add the sim to the dropdown menu so anyone can find it from the existing sims. This will also remove the UI warning that the sim is under development. Now tell everyone about your new sim!

# Add your spec to the raid sim
Don't touch the raid sim until the individual sim is ready for launch; anything in the raid sim is publicly accessible. To add your new spec to the raid sim, do the following:
 - Add a reference to the individual sim in `ui/raid/tsconfig.json`. DO NOT FORGET THIS STEP or Typescipt will silently do very bad things.
 - Import the individual sim's css file from `ui/raid/index.scss`.
 - Update `ui/raid/presets.ts` to include a constructor factory in the `specSimFactories` variable and add configurations for new Players in the `playerPresets` variable.

# Deployment
Thanks to the workflow defined in `.github/workflows/deploy.yml`, pushes to `master` automatically build and deploy a new site so there's nothing to do here. Sit back and appreciate your new sim!
