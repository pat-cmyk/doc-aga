#!/bin/bash

# Setup Husky pre-commit hooks
echo "Setting up Husky pre-commit hooks..."

# Initialize Husky
npx husky install

# Make pre-commit hook executable
chmod +x .husky/pre-commit

echo "✅ Husky pre-commit hooks configured successfully!"
echo "Tests and linting will now run before every commit."
