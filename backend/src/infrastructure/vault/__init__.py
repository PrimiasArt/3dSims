"""
Vault Storage Package.
Provides specialized Markdown and JSON stores along with the unified ObsidianVaultAdapter.
"""
from backend.src.infrastructure.vault.vault_json_store import VaultJsonStore
from backend.src.infrastructure.vault.vault_markdown_store import VaultMarkdownStore

__all__ = [
    "VaultJsonStore",
    "VaultMarkdownStore",
]
