# Third-party notices and provenance

The project license applies to original extension code. It does not replace licenses attached to third-party material.

- **SillyTavern** — host application and browser-test dependencies, AGPLv3. The test server reads the user's separately installed SillyTavern checkout; the host is not bundled here. https://github.com/SillyTavern/SillyTavern
- **RisuAI / risup format references** — the bounded module reader uses legacy Risu module framing and the RPack byte-permutation table. See the format-source links in V3 Asset Sprites' IMPORT-NOTES.md and comments in risu-module.js. The external risup CLI is not bundled. https://github.com/kwaroran/RisuAI and https://github.com/rescuetycoon/risup
- **Card display references** — technical fixtures/styles include source-derived display patterns. Their inclusion does not assert authorship or ownership of the original cards. Imported user cards and their assets are not covered by the project's licensing grant.
- **@adobe/css-tools 4.4.4** — MIT-licensed development dependency. Installed through npm for unit tests; not bundled with the extension runtime. Its notice is reproduced below.

(The MIT License)

Copyright (c) 2012 TJ Holowaychuk <tj@vision-media.ca>
Copyright (c) 2022 Jean-Philippe Zolesio <holblin@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
