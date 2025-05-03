# Local Dev Installation

This project has dependencies on Go >=1.23, protobuf-compiler and the corresponding Go plugins, and node >= 20.

## Ubuntu
Do not use apt to install any dependencies, the versions they install are all too old.
Script below will curl latest versions and install them.
```sh
# Standard Go installation script
curl -O https://dl.google.com/go/go1.23.4.linux-amd64.tar.gz
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf go1.23.4.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> $HOME/.bashrc
echo 'export GOPATH=$HOME/go' >> $HOME/.bashrc
echo 'export PATH=$PATH:$GOPATH/bin' >> $HOME/.bashrc
source $HOME/.bashrc

cd mop

# Install protobuf compiler and Go plugins
sudo apt update && sudo apt upgrade
sudo apt install protobuf-compiler
go get -u -v google.golang.org/protobuf
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest

# Install node
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20.13.1

# Install the npm package dependencies using node
npm install
```

## Docker
Alternatively, install Docker and your workflow will look something like this:
```sh
git clone https://github.com/wowsims/mop.git
cd mop

# Build the docker image and install npm dependencies (only need to run these once).
docker build --tag wowsims-mop .
docker run --rm -v $(pwd):/mop wowsims-mop npm install

# Now you can run the commands as shown in the Commands sections, preceding everything with, "docker run --rm -it -p 8080:8080 -v $(pwd):/mop wowsims-mop".
# For convenience, set this as an environment variable:
MOP_CMD="docker run --rm -it -p 8080:8080 -v $(pwd):/mop wowsims-mop"

#For the watch commands assign this environment variable:
MOP_WATCH_CMD="docker run --rm -it -p 8080:8080 -p 3333:3333 -p 5173:5173 -e WATCH=1 -v $(pwd):/mop wowsims-mop"

# ... do some coding on the sim ...

# Run tests
$(echo $MOP_CMD) make test

# ... do some coding on the UI ...

# Host a local site
$(echo $MOP_CMD) make host
```

## Windows
If you want to develop on Windows, we recommend setting up a Ubuntu virtual machine (VM) or running Docker using [this guide](https://docs.docker.com/desktop/windows/wsl/ "https://docs.docker.com/desktop/windows/wsl/") and then following the Ubuntu or Docker instructions, respectively.

If you prefer working natively:

- Install [Go](https://go.dev/dl/s), [NVM Windows](https://github.com/coreybutler/nvm-windows), and [make](https://gnuwin32.sourceforge.net/packages/make.htm) (you can also install it through Chocolate).
- Install and use Node 20+ from NVM, for example `nvm install 20 && nvm use 20`
- Setup GO workspace following [this guide](https://www.freecodecamp.org/news/setting-up-go-programming-language-on-windows-f02c8c14e2f/)
- Download GO dependencies [protobuf](https://github.com/protocolbuffers/protobuf/releases), [gopls](https://github.com/golang/tools/releases), [air-verse](https://github.com/air-verse/air/releases), [protobuf-go](https://github.com/protocolbuffers/protobuf-go/releases), and [staticcheck](https://github.com/dominikh/go-tools/releases). Unzip them into your GO workspace directory.

With all the dependencies setup, you should be able to run the `make` commands and compile the project.

## Mac OS
* Docker is available in OS X as well, so in theory similar instructions should work for the Docker method
* You can also use the Ubuntu setup instructions as above to run natively, with a few modifications:
  * You may need a different Go installer if `go1.18.3.linux-amd64.tar.gz` is not compatible with your system's architecture; you can do the Go install manually from `https://go.dev/doc/install`.
  * OS X uses Homebrew instead of apt, so in order to install protobuf-compiler you'll instead need to run `brew install protobuf-c` (note the package name is also a little different than in apt). You might need to first update or upgrade brew.
  * The provided install script for Node will not included a precompiled binary for OS X, but it's smart enough to compile one. Be ready for your CPU to melt on running `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash`.
