import assert from "node:assert/strict";
import test from "node:test";

import { findMatchingHtmlTag } from "../src/html-tag-matcher.js";

function substring(source: string, range: { start: number; end: number }): string {
  return source.slice(range.start, range.end);
}

test("matches simple opening tag to its closing counterpart", () => {
  const source = "<div>hello</div>";
  const cursor = source.indexOf("div") + 1;
  const match = findMatchingHtmlTag(source, cursor);
  assert.ok(match);
  assert.equal(substring(source, match.primary), "div");
  assert.ok(match.mate);
  assert.equal(substring(source, match.mate), "div");
  assert.equal(match.primary.start, source.indexOf("div"));
  assert.equal(match.mate.start, source.lastIndexOf("div"));
});

test("matches closing tag to its opening counterpart", () => {
  const source = "<div>hello</div>";
  const cursor = source.lastIndexOf("div");
  const match = findMatchingHtmlTag(source, cursor);
  assert.ok(match);
  assert.equal(match.mate?.start, source.indexOf("div"));
});

test("balances nested same-name tags", () => {
  const source = "<div><div>x</div></div>";
  const outerOpenCursor = source.indexOf("div") + 1;
  const outerOpenMatch = findMatchingHtmlTag(source, outerOpenCursor);
  assert.ok(outerOpenMatch);
  assert.ok(outerOpenMatch.mate);
  assert.equal(outerOpenMatch.mate.start, source.lastIndexOf("div"));

  const innerCloseCursor = source.indexOf("</div>") + 2;
  const innerMatch = findMatchingHtmlTag(source, innerCloseCursor);
  assert.ok(innerMatch);
  assert.ok(innerMatch.mate);
  assert.equal(innerMatch.mate.start, source.indexOf("<div>", 5) + 1);
});

test("returns null mate for self-closing tags", () => {
  const source = '<input type="text" />';
  const cursor = source.indexOf("input") + 2;
  const match = findMatchingHtmlTag(source, cursor);
  assert.ok(match);
  assert.equal(match.mate, null);
});

test("returns null mate for HTML void elements", () => {
  const source = "<br><p>x</p>";
  const cursor = source.indexOf("br") + 1;
  const match = findMatchingHtmlTag(source, cursor);
  assert.ok(match);
  assert.equal(match.mate, null);
});

test("skips Eta tags between HTML tags", () => {
  const source = "<div><% if (a) { %><span>x</span><% } %></div>";
  const cursor = source.indexOf("div") + 1;
  const match = findMatchingHtmlTag(source, cursor);
  assert.ok(match);
  assert.ok(match.mate);
  assert.equal(substring(source, match.mate), "div");
  assert.equal(match.mate.start, source.lastIndexOf("div"));
});

test("ignores Eta tag content that resembles HTML tags", () => {
  const source = "<div><% const tag = '<span>'; %></div>";
  const cursor = source.indexOf("div") + 1;
  const match = findMatchingHtmlTag(source, cursor);
  assert.ok(match);
  assert.ok(match.mate);
  assert.equal(match.mate.start, source.lastIndexOf("div"));
});

test("handles Eta tags inside HTML attribute values", () => {
  const source = '<div class="<%= it.cls %>">x</div>';
  const cursor = source.indexOf("div") + 1;
  const match = findMatchingHtmlTag(source, cursor);
  assert.ok(match);
  assert.ok(match.mate);
  assert.equal(match.mate.start, source.lastIndexOf("div"));
});

test("handles percent-close inside a quoted Eta string inside an attribute", () => {
  const source = '<div data-x="<% const marker = \'%>\'; %>">x</div>';
  const cursor = source.indexOf("div") + 1;
  const match = findMatchingHtmlTag(source, cursor);
  assert.ok(match);
  assert.ok(match.mate);
  assert.equal(match.mate.start, source.lastIndexOf("div"));
});

test("returns null when cursor is not on a tag name", () => {
  const source = "<div>hello</div>";
  const match = findMatchingHtmlTag(source, source.indexOf("hello") + 1);
  assert.equal(match, null);
});

test("returns null for unbalanced tags without a partner", () => {
  const source = "<div><span>hello</div>";
  const cursor = source.indexOf("span") + 1;
  const match = findMatchingHtmlTag(source, cursor);
  assert.ok(match);
  assert.equal(match.mate, null);
});

test("treats tag names case-insensitively", () => {
  const source = "<Div>hello</DIV>";
  const cursor = source.indexOf("Div") + 1;
  const match = findMatchingHtmlTag(source, cursor);
  assert.ok(match);
  assert.ok(match.mate);
  assert.equal(match.mate.start, source.lastIndexOf("DIV"));
});

test("matches custom-element tag names containing dashes", () => {
  const source = '<x-button data-id="1"><slot name="label"></slot></x-button>';
  const cursor = source.indexOf("x-button") + 2;
  const match = findMatchingHtmlTag(source, cursor);
  assert.ok(match);
  assert.ok(match.mate);
  assert.equal(substring(source, match.mate), "x-button");
});

test("matches tag names containing colons", () => {
  const source = "<svg:use href=\"#foo\"></svg:use>";
  const cursor = source.indexOf("svg:use") + 1;
  const match = findMatchingHtmlTag(source, cursor);
  assert.ok(match);
  assert.ok(match.mate);
  assert.equal(substring(source, match.primary), "svg:use");
  assert.equal(substring(source, match.mate), "svg:use");
});

test("matches tag names containing dots", () => {
  const source = "<app.Modal></app.Modal>";
  const cursor = source.indexOf("app.Modal") + 2;
  const match = findMatchingHtmlTag(source, cursor);
  assert.ok(match);
  assert.ok(match.mate);
  assert.equal(substring(source, match.primary), "app.Modal");
  assert.equal(substring(source, match.mate), "app.Modal");
});

test("matches names containing underscores", () => {
  const source = "<my_widget></my_widget>";
  const cursor = source.indexOf("my_widget") + 1;
  const match = findMatchingHtmlTag(source, cursor);
  assert.ok(match);
  assert.ok(match.mate);
  assert.equal(substring(source, match.primary), "my_widget");
});

test("matches across multi-line source with Eta control blocks", () => {
  const source = [
    "<section>",
    '  <div class="<%= it.cls %>">',
    "    <% if (it.ready) { %>",
    "      <span><%= it.label %></span>",
    "    <% } %>",
    "  </div>",
    "</section>"
  ].join("\n");
  const cursor = source.indexOf("section") + 1;
  const match = findMatchingHtmlTag(source, cursor);
  assert.ok(match);
  assert.ok(match.mate);
  assert.equal(substring(source, match.primary), "section");
  assert.equal(match.mate.start, source.lastIndexOf("section"));
});

test("recognises menuitem as a void element with no partner", () => {
  const source = "<menuitem><p>x</p>";
  const cursor = source.indexOf("menuitem") + 1;
  const match = findMatchingHtmlTag(source, cursor);
  assert.ok(match);
  assert.equal(match.mate, null);
});
