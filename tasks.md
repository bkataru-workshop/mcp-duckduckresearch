## project description

I want you to create an MCP server in TypeScript for me. Here's the idea: there are two MCP servers (and their source codes) in the current directory, `mcp-webresearch` and `duck-duck-mcp`

currently, `mcp-webresearch`'s `search_google` tool does not work but its `visit_page` and `take_screenshot` tools work perfectly.

`duck-duck-mcp` works perfectly but it only has capabilities to search and obtain links via DuckDuckGo, not to directly visit the pages or take screenshots like `mcp-webresearch` can

I want to combine the working ideas and functionalities from these two MCP servers and create a new MCP server which has the following tools

- `search_duckduckgo` - search duckduckgo and obtain links
- `visit_page` - visit a webpage and extract its content, take inspiration, code, and context from `mcp-webresearch`'s `visit_page` tool
- `take_screenshot` - take a screenshot of a webpage and extract its content, take inspiration, code, and context from `mcp-webresearch`'s `take_screenshot` tool

these tools must have same or similar parameters as the corresponding tools in `mcp-webresearch` and `duck-duck-mcp`

## things to keep in mind

- architect and come up with an implementation plan before writing any code
- think step by step (use the sequential thinking MCP tools) to help you in your tasks
- use the memory libsql MCP tools to store and retrieve information, entity relationships, and memory to help you in your tasks.
- use all the tools at your disposal apart from these two as well (you also have access to MCP tools that give you search capabilities)
- create a new npm project called `mcp-duckduckresearch`, which is the name of the MCP server you will be creating
- use node and npm to install any and all packages as necessary
- refer to the git repositories for `mcp-webresearch` and `duck-duck-mcp` for source code and implementation details
- setup linting and formatting with biome
- setup testing with vitest, write unit and integration tests, and run them to test your implementations

You will be executing in the following PowerShell session, so only use commands that are compatible with this version

```
 $PSVersionTable                                                                          
                                                                                           
Name                           Value                                                       
----                           -----                                                       
PSVersion                      5.1.26100.2161
PSEdition                      Desktop
PSCompatibleVersions           {1.0, 2.0, 3.0, 4.0...}
BuildVersion                   10.0.26100.2161
CLRVersion                     4.0.30319.42000
WSManStackVersion              3.0
PSRemotingProtocolVersion      2.3
SerializationVersion           1.1.0.1
```