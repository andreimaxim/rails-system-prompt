# Makefile for Rails System Prompt

# Default target
.PHONY: install
install: copy-prompt

# Copy the generated prompt to opencode config
.PHONY: copy-prompt
copy-prompt:
	@echo "Installing Rails prompt to opencode config..."
	@mkdir -p ~/.config/opencode/prompts
	@cp output/prompt.md ~/.config/opencode/prompts/rails.md
	@echo "Rails prompt installed successfully!"


# Help target
.PHONY: help
help:
	@echo "Available targets:"
	@echo "  install      - Copy prompt.md to ~/.config/opencode/prompts/rails.md (default)"
	@echo "  copy-prompt  - Same as install"
	@echo "  help         - Show this help message"
