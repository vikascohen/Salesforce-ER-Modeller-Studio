# V5 validation

**Crius Consulting · Updated: 14 November 2026**

Detailed test runs for earlier builds are available in Git history.

## Production release 5.0.0.4

| Check | Verified result |
| --- | --- |
| Dev Hub | Released, 91% package Apex coverage, coverage gate passed |
| Build / subscriber version | `08caj000000JavpAAC` / `04taj000000qN5NAAU` |
| Clean Developer scratch org | Installed successfully. Assigned Diagram Studio User, verified the System Information version, saved and reopened a diagram through the installed Apex controllers. |
| UI regressions | 36 suites and 293 tests passed, 10 skipped, with a 30-second per-test timeout. Earlier runs timed out at five seconds. |
| PSS source scan before packaging | Manual and verification scans each processed 104 work units, recorded 405 evidence rows and finished with zero scan errors. |

## Outstanding acceptance checks

- Exercise modules, imports, app generation, exports and subscriber permissions in an installed org.
- Check app-assigned Dynamic Forms across profiles and record types using configured pages.
- Scan populated standard OmniStudio definitions and verify the resulting evidence.
- Verify authenticated discovery, reads and scan requests from an external MCP client.
- Validate component ownership and migration for orgs with an older package installed.
