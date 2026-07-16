# Third-party notices for `tools/db2tool`

This tool is a pure-Go reimplementation of `tools/DB2ToSqlite` (.NET). Several
packages are Go translations (derivative works) of upstream C# libraries. Each
derived source file carries a short notice header pointing here; this file is
the authoritative list of upstreams, licenses, and pinned revisions.

| Package dir | Upstream | License | Pinned revision |
|---|---|---|---|
| `wdc/` | [wowdev/DBCD](https://github.com/wowdev/DBCD) (DBCD + DBCD.IO, v2.1.2 — the version vendored as DLLs in `tools/DB2ToSqlite/references/`) | MIT, Copyright (c) 2020 wowdev | `2180edb4d08b3822b3cfa964293ba8ccd4236ac0` |
| `dbd/` | [wowdev/WoWDBDefs](https://github.com/wowdev/WoWDBDefs) `code/C#/DBDefsLib` (**code** is BSD-3-Clause; the `.dbd` **data** files are CC BY-SA 4.0 and are fetched at build time, never vendored) | BSD-3-Clause, Copyright 2022 WoWDBDefs Contributors | `9002c532853a96d631c76dda50cb20189c27a173` (master at port time; the vendored DBDefsLib.dll is v1.0.0 with no embedded commit) |
| `tact/` | [wowdev/TACTSharp](https://github.com/wowdev/TACTSharp) v0.0.13-alpha | MIT | `d0ab516eb98b5db35682467b6e4977d88955046d` |
| `sqlite/`, `config/`, `main.go` | original repo code (ports of this repo's own `tools/DB2ToSqlite/Helpers/*.cs` and `Program.cs`) | repo MIT | — |

Runtime data dependencies (fetched, never vendored — see §4 of
`docs/db2tool-migration-plan.md`):

- `.dbd` definitions from WoWDBDefs (`definitions/<Table>.dbd`) — CC BY-SA 4.0,
  cached under a gitignored `DBDCache/`.
- `listfile.csv` (community listfile) — cached, gitignored.
- No TACT keys are used; encrypted DB2 sections are skipped (plan §7 C1).

## MIT License (wowdev/DBCD, wowdev/TACTSharp)

MIT License

Copyright (c) 2020 wowdev

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## BSD-3-Clause (WoWDBDefs code — applies to `dbd/`; these files stay BSD-3-Clause, not relicensed)

Copyright 2022 WoWDBDefs Contributors

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
