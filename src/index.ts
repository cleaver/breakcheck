#!/usr/bin/env npx tsx

import { setupCLI } from "./cli.js";

const cli = setupCLI();

// Parse and handle the command
const args = cli.parse();

console.log("cli output", args);
