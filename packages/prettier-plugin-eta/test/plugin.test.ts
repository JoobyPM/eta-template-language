import assert from "node:assert/strict";
import test from "node:test";

import * as prettier from "prettier";

import plugin from "../src/index.js";

async function formatEta(source: string, options: Record<string, unknown> = {}): Promise<string> {
  return prettier.format(source, {
    parser: "eta-template",
    plugins: [plugin],
    ...options
  });
}

test("formats interpolation and surrounding html", async () => {
  const result = await formatEta("<div><%=foo +bar%></div>");
  assert.equal(result, "<div><%= foo + bar %></div>\n");
});

test("formats control flow blocks and nested html", async () => {
  const source = "<ul><% for(const item of items){ %><li><%=item.name%></li><% } %></ul>";
  const result = await formatEta(source);
  assert.equal(
    result,
    "<ul>\n  <% for (const item of items) { %>\n  <li><%= item.name %></li>\n  <% } %>\n</ul>\n"
  );
});

test("keeps percent-close inside javascript strings safe", async () => {
  const result = await formatEta('<% const marker = "%>"; %>');
  assert.equal(result, '<% const marker = "%>"; %>\n');
});

test("formats template literal output without breaking interpolation", async () => {
  const result = await formatEta("<%=`Hello ${ user.name }`%>");
  assert.equal(result, "<%= `Hello ${user.name}` %>\n");
});

test("formats trim markers in canonical eta form", async () => {
  const result = await formatEta("<div><%-=it.name-%></div>");
  assert.equal(result, "<div><%-= it.name -%></div>\n");
});

test("normalizes comment tag whitespace", async () => {
  const result = await formatEta("<%#   keep   this   note   %>");
  assert.equal(result, "<%# keep this note %>\n");
});

test("can skip html formatting while still formatting eta tags", async () => {
  const result = await formatEta("<div>  <%=foo%></div>", {
    etaFormatHtml: false
  });
  assert.equal(result, "<div>  <%= foo %></div>\n");
});

test("preserves literal text that resembles a slot placeholder", async () => {
  const result = await formatEta("<div>ETATAGSLOT0TOKEN <%= foo %></div>");
  assert.equal(result, "<div>ETATAGSLOT0TOKEN <%= foo %></div>\n");
});

test("preserves whitespace inside string, regex, and template literals", async () => {
  const source = [
    '<% const text = "hello   world"; %>',
    "<% const pattern = /hello   world/g; %>",
    "<%= `line1",
    "  line2` %>",
    '<% layout("./my  path") %>'
  ].join("\n");

  const result = await formatEta(source, {
    trailingComma: "all"
  });

  assert.equal(
    result,
    [
      '<% const text = "hello   world"; %>',
      "<% const pattern = /hello   world/g; %>",
      "<%=",
      "`line1",
      "  line2`",
      "%>",
      '<% layout("./my  path"); %>',
      ""
    ].join("\n")
  );
});

test("formats eta line comments without breaking idempotence", async () => {
  const firstPass = await formatEta("<% // note %>");
  const secondPass = await formatEta(firstPass);

  assert.equal(firstPass, "<% // note %>\n");
  assert.equal(secondPass, firstPass);
});

test("preserves adjacent tag line breaks", async () => {
  const result = await formatEta("<%# a comment %>\n<%= foo %>\n");
  assert.equal(result, "<%# a comment %>\n<%= foo %>\n");
});

test("formats markdown eta templates with the markdown parser", async () => {
  const source = [
    "# Configuration",
    "",
    "> Auto-generated for <%=it.service%>",
    "",
    "| Key | Value |",
    "| --- | --- |",
    "<% for (const item of items) { %>",
    "| <%=item.key%> | <%=item.value%> |",
    "<% } %>"
  ].join("\n");

  const result = await formatEta(source, {
    filepath: "/tmp/configuration.md.eta",
    printWidth: 120,
    proseWrap: "preserve"
  });

  assert.equal(
    result,
    [
      "# Configuration",
      "",
      "> Auto-generated for <%= it.service %>",
      "",
      "| Key | Value |",
      "| --- | ----- |",
      "",
      "<% for (const item of items) { %>",
      "| <%= item.key %> | <%= item.value %> |",
      "<% } %>",
      ""
    ].join("\n")
  );
});

test("rejects malformed eta tags", async () => {
  await assert.rejects(() => formatEta("<% if (enabled) { "), /Unterminated Eta tag/);
});

test("remains idempotent across the sample eta corpus", async () => {
  const cases = [
    "<% if (enabled) { %><div><%= it.name %></div><% } %>",
    "<% // note %>",
    "<% } else if (it.ready) { %>",
    "<% const value = { foo: [1, 2, 3] } %>",
    "<div><%-=it.name-%></div>"
  ];

  for (const source of cases) {
    const once = await formatEta(source, { trailingComma: "all" });
    const twice = await formatEta(once, { trailingComma: "all" });
    assert.equal(twice, once, `formatter should be idempotent for ${source}`);
  }
});
