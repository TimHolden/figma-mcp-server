# Troubleshooting Guide for Figma MCP Server

This guide addresses common issues when connecting the Figma MCP Server to Claude Desktop.

## JSON Errors When Connecting

If you're seeing JSON errors in Claude Desktop logs when trying to connect to the Figma MCP Server:

### Common Issues and Solutions

1. **Invalid Path in Configuration**
   - **Issue**: The path to the server's index.js file is incorrect or uses relative paths
   - **Solution**: Use absolute paths to the server's index.js file
     - macOS: `/Users/username/path/to/figma-mcp-server/dist/index.js`
     - Windows: `C:\\Users\\username\\path\\to\\figma-mcp-server\\dist\\index.js`

2. **Missing Environment Variables**
   - **Issue**: Required environment variables like FIGMA_ACCESS_TOKEN are missing
   - **Solution**: Make sure to include all required environment variables in your configuration:
     ```json
     "env": {
       "FIGMA_ACCESS_TOKEN": "your_figma_token_here"
     }
     ```

3. **Incorrect JSON Format**
   - **Issue**: The Claude Desktop config.json file has syntax errors
   - **Solution**: Validate your JSON using a tool like [JSONLint](https://jsonlint.com/)

4. **Server Not Built**
   - **Issue**: The server hasn't been built (dist/index.js doesn't exist)
   - **Solution**: Run `npm run build` in the project directory

5. **Incorrect Node Path**
   - **Issue**: The node executable can't be found
   - **Solution**: Use the full path to node if needed:
     - macOS: `"/usr/local/bin/node"` or wherever your node is installed
     - Windows: `"C:\\Program Files\\nodejs\\node.exe"`

## Checking Claude Desktop Logs

To diagnose connection issues, check the Claude Desktop logs:

- **macOS**: `~/Library/Logs/Claude/mcp*.log`
- **Windows**: `%APPDATA%\\Claude\\logs\\mcp*.log`

You can view these logs using:
```bash
# On macOS
tail -f ~/Library/Logs/Claude/mcp*.log

# On Windows PowerShell
Get-Content -Path "$env:APPDATA\\Claude\\logs\\mcp*.log" -Wait
```

## Verifying Your Server Works

Test your server separately before connecting to Claude:

```bash
# First, build the server
npm run build

# Then run it directly to check for errors
node dist/index.js
```

If it starts without errors, the problem is likely in your Claude Desktop configuration.

## Still Having Issues?

If you're still experiencing problems after trying the above solutions:

1. Check your Figma access token is valid
2. Try a simpler MCP server first to rule out Claude Desktop configuration issues
3. Reinstall Claude Desktop
4. File an issue on the GitHub repository with:
   - Exact error messages from the logs
   - Your configuration (with sensitive info removed)
   - Your operating system and Node.js version
