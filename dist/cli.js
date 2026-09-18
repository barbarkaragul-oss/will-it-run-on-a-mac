import { createRequire as __wiroamCreateRequire } from 'node:module'; const require = __wiroamCreateRequire(import.meta.url);

// src/cli.ts
import { readFileSync as readFileSync2, readdirSync, statSync, existsSync as existsSync2 } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// src/action/core.ts
import { readFileSync, existsSync } from "node:fs";

// node_modules/web-tree-sitter/web-tree-sitter.js
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var Edit = class {
  static {
    __name(this, "Edit");
  }
  /** The start position of the change. */
  startPosition;
  /** The end position of the change before the edit. */
  oldEndPosition;
  /** The end position of the change after the edit. */
  newEndPosition;
  /** The start index of the change. */
  startIndex;
  /** The end index of the change before the edit. */
  oldEndIndex;
  /** The end index of the change after the edit. */
  newEndIndex;
  constructor({
    startIndex,
    oldEndIndex,
    newEndIndex,
    startPosition,
    oldEndPosition,
    newEndPosition
  }) {
    this.startIndex = startIndex >>> 0;
    this.oldEndIndex = oldEndIndex >>> 0;
    this.newEndIndex = newEndIndex >>> 0;
    this.startPosition = startPosition;
    this.oldEndPosition = oldEndPosition;
    this.newEndPosition = newEndPosition;
  }
  /**
   * Edit a point and index to keep it in-sync with source code that has been edited.
   *
   * This function updates a single point's byte offset and row/column position
   * based on an edit operation. This is useful for editing points without
   * requiring a tree or node instance.
   */
  editPoint(point, index) {
    let newIndex = index;
    const newPoint = { ...point };
    if (index >= this.oldEndIndex) {
      newIndex = this.newEndIndex + (index - this.oldEndIndex);
      const originalRow = point.row;
      newPoint.row = this.newEndPosition.row + (point.row - this.oldEndPosition.row);
      newPoint.column = originalRow === this.oldEndPosition.row ? this.newEndPosition.column + (point.column - this.oldEndPosition.column) : point.column;
    } else if (index > this.startIndex) {
      newIndex = this.newEndIndex;
      newPoint.row = this.newEndPosition.row;
      newPoint.column = this.newEndPosition.column;
    }
    return { point: newPoint, index: newIndex };
  }
  /**
   * Edit a range to keep it in-sync with source code that has been edited.
   *
   * This function updates a range's start and end positions based on an edit
   * operation. This is useful for editing ranges without requiring a tree
   * or node instance.
   */
  editRange(range) {
    const newRange = {
      startIndex: range.startIndex,
      startPosition: { ...range.startPosition },
      endIndex: range.endIndex,
      endPosition: { ...range.endPosition }
    };
    if (range.endIndex >= this.oldEndIndex) {
      if (range.endIndex !== Number.MAX_SAFE_INTEGER) {
        newRange.endIndex = this.newEndIndex + (range.endIndex - this.oldEndIndex);
        newRange.endPosition = {
          row: this.newEndPosition.row + (range.endPosition.row - this.oldEndPosition.row),
          column: range.endPosition.row === this.oldEndPosition.row ? this.newEndPosition.column + (range.endPosition.column - this.oldEndPosition.column) : range.endPosition.column
        };
        if (newRange.endIndex < this.newEndIndex) {
          newRange.endIndex = Number.MAX_SAFE_INTEGER;
          newRange.endPosition = { row: Number.MAX_SAFE_INTEGER, column: Number.MAX_SAFE_INTEGER };
        }
      }
    } else if (range.endIndex > this.startIndex) {
      newRange.endIndex = this.startIndex;
      newRange.endPosition = { ...this.startPosition };
    }
    if (range.startIndex >= this.oldEndIndex) {
      newRange.startIndex = this.newEndIndex + (range.startIndex - this.oldEndIndex);
      newRange.startPosition = {
        row: this.newEndPosition.row + (range.startPosition.row - this.oldEndPosition.row),
        column: range.startPosition.row === this.oldEndPosition.row ? this.newEndPosition.column + (range.startPosition.column - this.oldEndPosition.column) : range.startPosition.column
      };
      if (newRange.startIndex < this.newEndIndex) {
        newRange.startIndex = Number.MAX_SAFE_INTEGER;
        newRange.startPosition = { row: Number.MAX_SAFE_INTEGER, column: Number.MAX_SAFE_INTEGER };
      }
    } else if (range.startIndex > this.startIndex) {
      newRange.startIndex = this.startIndex;
      newRange.startPosition = { ...this.startPosition };
    }
    return newRange;
  }
};
var SIZE_OF_SHORT = 2;
var SIZE_OF_INT = 4;
var SIZE_OF_CURSOR = 4 * SIZE_OF_INT;
var SIZE_OF_NODE = 5 * SIZE_OF_INT;
var SIZE_OF_POINT = 2 * SIZE_OF_INT;
var SIZE_OF_RANGE = 2 * SIZE_OF_INT + 2 * SIZE_OF_POINT;
var ZERO_POINT = { row: 0, column: 0 };
var INTERNAL = /* @__PURE__ */ Symbol("INTERNAL");
function assertInternal(x) {
  if (x !== INTERNAL) throw new Error("Illegal constructor");
}
__name(assertInternal, "assertInternal");
function isPoint(point) {
  return !!point && typeof point.row === "number" && typeof point.column === "number";
}
__name(isPoint, "isPoint");
function setModule(module2) {
  C = module2;
}
__name(setModule, "setModule");
var C;
function newFinalizer(handler) {
  try {
    return new FinalizationRegistry(handler);
  } catch (e) {
    console.error("Unsupported FinalizationRegistry:", e);
    return;
  }
}
__name(newFinalizer, "newFinalizer");
var finalizer = newFinalizer((address) => {
  C._ts_lookahead_iterator_delete(address);
});
var LookaheadIterator = class {
  static {
    __name(this, "LookaheadIterator");
  }
  /** @internal */
  [0] = 0;
  // Internal handle for Wasm
  /** @internal */
  language;
  /** @internal */
  positioned = false;
  /** @internal */
  constructor(internal, address, language) {
    assertInternal(internal);
    this[0] = address;
    this.language = language;
    finalizer?.register(this, address, this);
  }
  /**
   * Get the current symbol of the lookahead iterator.
   *
   * Returns `null` if the iterator is not positioned on a symbol:
   *
   * - Before the first iteration step
   * - After the iterator is exhausted
   * - After a {@link reset} or {@link resetState} call
   */
  get currentTypeId() {
    return this.positioned ? C._ts_lookahead_iterator_current_symbol(this[0]) : null;
  }
  /**
   * Get the current symbol name of the lookahead iterator.
   *
   * Returns `null` if the iterator is not positioned on a symbol.
   */
  get currentType() {
    const id = this.currentTypeId;
    if (id === null) return null;
    return this.language.types[id] ?? C.UTF8ToString(C._ts_language_symbol_name(this.language[0], id));
  }
  /** Delete the lookahead iterator, freeing its resources. */
  delete() {
    finalizer?.unregister(this);
    C._ts_lookahead_iterator_delete(this[0]);
    this[0] = 0;
  }
  /**
   * Reset the lookahead iterator.
   *
   * This returns `true` if the language was set successfully and `false`
   * otherwise.
   */
  reset(language, stateId) {
    if (C._ts_lookahead_iterator_reset(this[0], language[0], stateId)) {
      this.language = language;
      this.positioned = false;
      return true;
    }
    return false;
  }
  /**
   * Reset the lookahead iterator to another state.
   *
   * This returns `true` if the iterator was reset to the given state and
   * `false` otherwise.
   */
  resetState(stateId) {
    if (!C._ts_lookahead_iterator_reset_state(this[0], stateId)) return false;
    this.positioned = false;
    return true;
  }
  /**
   * Returns an iterator that iterates over the symbols of the lookahead iterator.
   *
   * The iterator will yield the current symbol name as a string for each step
   * until there are no more symbols to iterate over.
   */
  [Symbol.iterator]() {
    return {
      next: /* @__PURE__ */ __name(() => {
        this.positioned = Boolean(C._ts_lookahead_iterator_next(this[0]));
        const value = this.currentType;
        return value === null ? { done: true, value: "" } : { done: false, value };
      }, "next")
    };
  }
};
function getText(tree, startIndex, endIndex, startPosition) {
  const length = endIndex - startIndex;
  let result = tree.textCallback(startIndex, startPosition);
  if (result) {
    startIndex += result.length;
    while (startIndex < endIndex) {
      const string = tree.textCallback(startIndex, startPosition);
      if (string && string.length > 0) {
        startIndex += string.length;
        result += string;
      } else {
        break;
      }
    }
    if (startIndex > endIndex) {
      result = result.slice(0, length);
    }
  }
  return result ?? "";
}
__name(getText, "getText");
var finalizer2 = newFinalizer((address) => {
  C._ts_tree_delete(address);
});
var Tree = class _Tree {
  static {
    __name(this, "Tree");
  }
  /** @internal */
  [0] = 0;
  // Internal handle for Wasm
  /** @internal */
  textCallback;
  /** The language that was used to parse the syntax tree. */
  language;
  /** @internal */
  constructor(internal, address, language, textCallback) {
    assertInternal(internal);
    this[0] = address;
    this.language = language;
    this.textCallback = textCallback;
    finalizer2?.register(this, address, this);
  }
  /** Create a shallow copy of the syntax tree. This is very fast. */
  copy() {
    const address = C._ts_tree_copy(this[0]);
    return new _Tree(INTERNAL, address, this.language, this.textCallback);
  }
  /** Delete the syntax tree, freeing its resources. */
  delete() {
    finalizer2?.unregister(this);
    C._ts_tree_delete(this[0]);
    this[0] = 0;
  }
  /** Get the root node of the syntax tree. */
  get rootNode() {
    C._ts_tree_root_node_wasm(this[0]);
    return unmarshalNode(this);
  }
  /**
   * Get the root node of the syntax tree, but with its position shifted
   * forward by the given offset.
   */
  rootNodeWithOffset(offsetBytes, offsetExtent) {
    const address = TRANSFER_BUFFER + SIZE_OF_NODE;
    C.setValue(address, offsetBytes, "i32");
    marshalPoint(address + SIZE_OF_INT, offsetExtent);
    C._ts_tree_root_node_with_offset_wasm(this[0]);
    return unmarshalNode(this);
  }
  /**
   * Edit the syntax tree to keep it in sync with source code that has been
   * edited.
   *
   * You must describe the edit both in terms of byte offsets and in terms of
   * row/column coordinates.
   */
  edit(edit) {
    marshalEdit(edit);
    C._ts_tree_edit_wasm(this[0]);
  }
  /** Create a new {@link TreeCursor} starting from the root of the tree. */
  walk() {
    return this.rootNode.walk();
  }
  /**
   * Compare this old edited syntax tree to a new syntax tree representing
   * the same document, returning a sequence of ranges whose syntactic
   * structure has changed.
   *
   * For this to work correctly, this syntax tree must have been edited such
   * that its ranges match up to the new tree. Generally, you'll want to
   * call this method right after calling one of the [`Parser::parse`]
   * functions. Call it on the old tree that was passed to parse, and
   * pass the new tree that was returned from `parse`.
   */
  getChangedRanges(other) {
    if (!(other instanceof _Tree)) {
      throw new TypeError("Argument must be a Tree");
    }
    C._ts_tree_get_changed_ranges_wasm(this[0], other[0]);
    const count = C.getValue(TRANSFER_BUFFER, "i32");
    const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
    const result = new Array(count);
    if (count > 0) {
      let address = buffer;
      for (let i2 = 0; i2 < count; i2++) {
        result[i2] = unmarshalRange(address);
        address += SIZE_OF_RANGE;
      }
      C._free(buffer);
    }
    return result;
  }
  /** Get the included ranges that were used to parse the syntax tree. */
  getIncludedRanges() {
    C._ts_tree_included_ranges_wasm(this[0]);
    const count = C.getValue(TRANSFER_BUFFER, "i32");
    const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
    const result = new Array(count);
    if (count > 0) {
      let address = buffer;
      for (let i2 = 0; i2 < count; i2++) {
        result[i2] = unmarshalRange(address);
        address += SIZE_OF_RANGE;
      }
      C._free(buffer);
    }
    return result;
  }
};
var finalizer3 = newFinalizer((address) => {
  C._ts_tree_cursor_delete_wasm(address);
});
var TreeCursor = class _TreeCursor {
  static {
    __name(this, "TreeCursor");
  }
  /** @internal */
  // @ts-expect-error: never read
  [0] = 0;
  // Internal handle for Wasm
  /** @internal */
  // @ts-expect-error: never read
  [1] = 0;
  // Internal handle for Wasm
  /** @internal */
  // @ts-expect-error: never read
  [2] = 0;
  // Internal handle for Wasm
  /** @internal */
  // @ts-expect-error: never read
  [3] = 0;
  // Internal handle for Wasm
  /** @internal */
  tree;
  /** @internal */
  constructor(internal, tree) {
    assertInternal(internal);
    this.tree = tree;
    unmarshalTreeCursor(this);
    finalizer3?.register(this, this.tree[0], this);
  }
  /** Creates a deep copy of the tree cursor. This allocates new memory. */
  copy() {
    const copy = new _TreeCursor(INTERNAL, this.tree);
    C._ts_tree_cursor_copy_wasm(this.tree[0]);
    unmarshalTreeCursor(copy);
    return copy;
  }
  /** Delete the tree cursor, freeing its resources. */
  delete() {
    finalizer3?.unregister(this);
    marshalTreeCursor(this);
    C._ts_tree_cursor_delete_wasm(this.tree[0]);
    this[0] = this[1] = this[2] = 0;
  }
  /** Get the tree cursor's current {@link Node}. */
  get currentNode() {
    marshalTreeCursor(this);
    C._ts_tree_cursor_current_node_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }
  /**
   * Get the numerical field id of this tree cursor's current node.
   *
   * See also {@link TreeCursor#currentFieldName}.
   */
  get currentFieldId() {
    marshalTreeCursor(this);
    return C._ts_tree_cursor_current_field_id_wasm(this.tree[0]);
  }
  /** Get the field name of this tree cursor's current node. */
  get currentFieldName() {
    return this.tree.language.fields[this.currentFieldId];
  }
  /**
   * Get the depth of the cursor's current node relative to the original
   * node that the cursor was constructed with.
   */
  get currentDepth() {
    marshalTreeCursor(this);
    return C._ts_tree_cursor_current_depth_wasm(this.tree[0]);
  }
  /**
   * Get the index of the cursor's current node out of all of the
   * descendants of the original node that the cursor was constructed with.
   */
  get currentDescendantIndex() {
    marshalTreeCursor(this);
    return C._ts_tree_cursor_current_descendant_index_wasm(this.tree[0]);
  }
  /** Get the type of the cursor's current node. */
  get nodeType() {
    return this.tree.language.types[this.nodeTypeId] || "ERROR";
  }
  /** Get the type id of the cursor's current node. */
  get nodeTypeId() {
    marshalTreeCursor(this);
    return C._ts_tree_cursor_current_node_type_id_wasm(this.tree[0]);
  }
  /** Get the state id of the cursor's current node. */
  get nodeStateId() {
    marshalTreeCursor(this);
    return C._ts_tree_cursor_current_node_state_id_wasm(this.tree[0]);
  }
  /** Get the id of the cursor's current node. */
  get nodeId() {
    marshalTreeCursor(this);
    return C._ts_tree_cursor_current_node_id_wasm(this.tree[0]);
  }
  /**
   * Check if the cursor's current node is *named*.
   *
   * Named nodes correspond to named rules in the grammar, whereas
   * *anonymous* nodes correspond to string literals in the grammar.
   */
  get nodeIsNamed() {
    marshalTreeCursor(this);
    return C._ts_tree_cursor_current_node_is_named_wasm(this.tree[0]) === 1;
  }
  /**
   * Check if the cursor's current node is *missing*.
   *
   * Missing nodes are inserted by the parser in order to recover from
   * certain kinds of syntax errors.
   */
  get nodeIsMissing() {
    marshalTreeCursor(this);
    return C._ts_tree_cursor_current_node_is_missing_wasm(this.tree[0]) === 1;
  }
  /** Get the string content of the cursor's current node. */
  get nodeText() {
    marshalTreeCursor(this);
    const startIndex = C._ts_tree_cursor_start_index_wasm(this.tree[0]);
    const endIndex = C._ts_tree_cursor_end_index_wasm(this.tree[0]);
    C._ts_tree_cursor_start_position_wasm(this.tree[0]);
    const startPosition = unmarshalPoint(TRANSFER_BUFFER);
    return getText(this.tree, startIndex, endIndex, startPosition);
  }
  /** Get the start position of the cursor's current node. */
  get startPosition() {
    marshalTreeCursor(this);
    C._ts_tree_cursor_start_position_wasm(this.tree[0]);
    return unmarshalPoint(TRANSFER_BUFFER);
  }
  /** Get the end position of the cursor's current node. */
  get endPosition() {
    marshalTreeCursor(this);
    C._ts_tree_cursor_end_position_wasm(this.tree[0]);
    return unmarshalPoint(TRANSFER_BUFFER);
  }
  /** Get the start index of the cursor's current node. */
  get startIndex() {
    marshalTreeCursor(this);
    return C._ts_tree_cursor_start_index_wasm(this.tree[0]);
  }
  /** Get the end index of the cursor's current node. */
  get endIndex() {
    marshalTreeCursor(this);
    return C._ts_tree_cursor_end_index_wasm(this.tree[0]);
  }
  /**
   * Move this cursor to the first child of its current node.
   *
   * This returns `true` if the cursor successfully moved, and returns
   * `false` if there were no children.
   */
  gotoFirstChild() {
    marshalTreeCursor(this);
    const result = C._ts_tree_cursor_goto_first_child_wasm(this.tree[0]);
    unmarshalTreeCursor(this);
    return result === 1;
  }
  /**
   * Move this cursor to the last child of its current node.
   *
   * This returns `true` if the cursor successfully moved, and returns
   * `false` if there were no children.
   *
   * Note that this function may be slower than
   * {@link TreeCursor#gotoFirstChild} because it needs to
   * iterate through all the children to compute the child's position.
   */
  gotoLastChild() {
    marshalTreeCursor(this);
    const result = C._ts_tree_cursor_goto_last_child_wasm(this.tree[0]);
    unmarshalTreeCursor(this);
    return result === 1;
  }
  /**
   * Move this cursor to the parent of its current node.
   *
   * This returns `true` if the cursor successfully moved, and returns
   * `false` if there was no parent node (the cursor was already on the
   * root node).
   *
   * Note that the node the cursor was constructed with is considered the root
   * of the cursor, and the cursor cannot walk outside this node.
   */
  gotoParent() {
    marshalTreeCursor(this);
    const result = C._ts_tree_cursor_goto_parent_wasm(this.tree[0]);
    unmarshalTreeCursor(this);
    return result === 1;
  }
  /**
   * Move this cursor to the next sibling of its current node.
   *
   * This returns `true` if the cursor successfully moved, and returns
   * `false` if there was no next sibling node.
   *
   * Note that the node the cursor was constructed with is considered the root
   * of the cursor, and the cursor cannot walk outside this node.
   */
  gotoNextSibling() {
    marshalTreeCursor(this);
    const result = C._ts_tree_cursor_goto_next_sibling_wasm(this.tree[0]);
    unmarshalTreeCursor(this);
    return result === 1;
  }
  /**
   * Move this cursor to the previous sibling of its current node.
   *
   * This returns `true` if the cursor successfully moved, and returns
   * `false` if there was no previous sibling node.
   *
   * Note that this function may be slower than
   * {@link TreeCursor#gotoNextSibling} due to how node
   * positions are stored. In the worst case, this will need to iterate
   * through all the children up to the previous sibling node to recalculate
   * its position. Also note that the node the cursor was constructed with is
   * considered the root of the cursor, and the cursor cannot walk outside this node.
   */
  gotoPreviousSibling() {
    marshalTreeCursor(this);
    const result = C._ts_tree_cursor_goto_previous_sibling_wasm(this.tree[0]);
    unmarshalTreeCursor(this);
    return result === 1;
  }
  /**
   * Move the cursor to the node that is the nth descendant of
   * the original node that the cursor was constructed with, where
   * zero represents the original node itself.
   */
  gotoDescendant(goalDescendantIndex) {
    marshalTreeCursor(this);
    C._ts_tree_cursor_goto_descendant_wasm(this.tree[0], goalDescendantIndex);
    unmarshalTreeCursor(this);
  }
  /**
   * Move this cursor to the first child of its current node that contains or
   * starts after the given byte offset.
   *
   * This returns `true` if the cursor successfully moved to a child node, and returns
   * `false` if no such child was found.
   */
  gotoFirstChildForIndex(goalIndex) {
    marshalTreeCursor(this);
    C.setValue(TRANSFER_BUFFER + SIZE_OF_CURSOR, goalIndex, "i32");
    const result = C._ts_tree_cursor_goto_first_child_for_index_wasm(this.tree[0]);
    unmarshalTreeCursor(this);
    return result === 1;
  }
  /**
   * Move this cursor to the first child of its current node that contains or
   * starts after the given byte offset.
   *
   * This returns the index of the child node if one was found, and returns
   * `null` if no such child was found.
   */
  gotoFirstChildForPosition(goalPosition) {
    marshalTreeCursor(this);
    marshalPoint(TRANSFER_BUFFER + SIZE_OF_CURSOR, goalPosition);
    const result = C._ts_tree_cursor_goto_first_child_for_position_wasm(this.tree[0]);
    unmarshalTreeCursor(this);
    return result === 1;
  }
  /**
   * Re-initialize this tree cursor to start at the original node that the
   * cursor was constructed with.
   */
  reset(node) {
    marshalNode(node);
    marshalTreeCursor(this, TRANSFER_BUFFER + SIZE_OF_NODE);
    C._ts_tree_cursor_reset_wasm(this.tree[0]);
    unmarshalTreeCursor(this);
  }
  /**
   * Re-initialize a tree cursor to the same position as another cursor.
   *
   * Unlike {@link TreeCursor#reset}, this will not lose parent
   * information and allows reusing already created cursors.
   */
  resetTo(cursor) {
    marshalTreeCursor(this, TRANSFER_BUFFER);
    marshalTreeCursor(cursor, TRANSFER_BUFFER + SIZE_OF_CURSOR);
    C._ts_tree_cursor_reset_to_wasm(this.tree[0], cursor.tree[0]);
    unmarshalTreeCursor(this);
  }
};
var Node = class {
  static {
    __name(this, "Node");
  }
  /** @internal */
  // @ts-expect-error: never read
  [0] = 0;
  // Internal handle for Wasm
  /** @internal */
  _children;
  /** @internal */
  _namedChildren;
  /** @internal */
  constructor(internal, {
    id,
    tree,
    startIndex,
    startPosition,
    other
  }) {
    assertInternal(internal);
    this[0] = other;
    this.id = id;
    this.tree = tree;
    this.startIndex = startIndex;
    this.startPosition = startPosition;
  }
  /**
   * The numeric id for this node that is unique.
   *
   * Within a given syntax tree, no two nodes have the same id. However:
   *
   * * If a new tree is created based on an older tree, and a node from the old tree is reused in
   *   the process, then that node will have the same id in both trees.
   *
   * * A node not marked as having changes does not guarantee it was reused.
   *
   * * If a node is marked as having changed in the old tree, it will not be reused.
   */
  id;
  /** The byte index where this node starts. */
  startIndex;
  /** The position where this node starts. */
  startPosition;
  /** The tree that this node belongs to. */
  tree;
  /** Get this node's type as a numerical id. */
  get typeId() {
    marshalNode(this);
    return C._ts_node_symbol_wasm(this.tree[0]);
  }
  /**
   * Get the node's type as a numerical id as it appears in the grammar,
   * ignoring aliases.
   */
  get grammarId() {
    marshalNode(this);
    return C._ts_node_grammar_symbol_wasm(this.tree[0]);
  }
  /** Get this node's type as a string. */
  get type() {
    return this.tree.language.types[this.typeId] || "ERROR";
  }
  /**
   * Get this node's symbol name as it appears in the grammar, ignoring
   * aliases as a string.
   */
  get grammarType() {
    return this.tree.language.types[this.grammarId] || "ERROR";
  }
  /**
   * Check if this node is *named*.
   *
   * Named nodes correspond to named rules in the grammar, whereas
   * *anonymous* nodes correspond to string literals in the grammar.
   */
  get isNamed() {
    marshalNode(this);
    return C._ts_node_is_named_wasm(this.tree[0]) === 1;
  }
  /**
   * Check if this node is *extra*.
   *
   * Extra nodes represent things like comments, which are not required
   * by the grammar, but can appear anywhere.
   */
  get isExtra() {
    marshalNode(this);
    return C._ts_node_is_extra_wasm(this.tree[0]) === 1;
  }
  /**
   * Check if this node represents a syntax error.
   *
   * Syntax errors represent parts of the code that could not be incorporated
   * into a valid syntax tree.
   */
  get isError() {
    marshalNode(this);
    return C._ts_node_is_error_wasm(this.tree[0]) === 1;
  }
  /**
   * Check if this node is *missing*.
   *
   * Missing nodes are inserted by the parser in order to recover from
   * certain kinds of syntax errors.
   */
  get isMissing() {
    marshalNode(this);
    return C._ts_node_is_missing_wasm(this.tree[0]) === 1;
  }
  /** Check if this node has been edited. */
  get hasChanges() {
    marshalNode(this);
    return C._ts_node_has_changes_wasm(this.tree[0]) === 1;
  }
  /**
   * Check if this node represents a syntax error or contains any syntax
   * errors anywhere within it.
   */
  get hasError() {
    marshalNode(this);
    return C._ts_node_has_error_wasm(this.tree[0]) === 1;
  }
  /** Get the byte index where this node ends. */
  get endIndex() {
    marshalNode(this);
    return C._ts_node_end_index_wasm(this.tree[0]);
  }
  /** Get the position where this node ends. */
  get endPosition() {
    marshalNode(this);
    C._ts_node_end_point_wasm(this.tree[0]);
    return unmarshalPoint(TRANSFER_BUFFER);
  }
  /** Get the string content of this node. */
  get text() {
    return getText(this.tree, this.startIndex, this.endIndex, this.startPosition);
  }
  /** Get this node's parse state. */
  get parseState() {
    marshalNode(this);
    return C._ts_node_parse_state_wasm(this.tree[0]);
  }
  /** Get the parse state after this node. */
  get nextParseState() {
    marshalNode(this);
    return C._ts_node_next_parse_state_wasm(this.tree[0]);
  }
  /** Check if this node is equal to another node. */
  equals(other) {
    return this.tree === other.tree && this.id === other.id;
  }
  /**
   * Get the node's child at the given index, where zero represents the first child.
   *
   * This method is fairly fast, but its cost is technically log(n), so if
   * you might be iterating over a long list of children, you should use
   * {@link Node#children} instead.
   */
  child(index) {
    marshalNode(this);
    C._ts_node_child_wasm(this.tree[0], index);
    return unmarshalNode(this.tree);
  }
  /**
   * Get this node's *named* child at the given index.
   *
   * See also {@link Node#isNamed}.
   * This method is fairly fast, but its cost is technically log(n), so if
   * you might be iterating over a long list of children, you should use
   * {@link Node#namedChildren} instead.
   */
  namedChild(index) {
    marshalNode(this);
    C._ts_node_named_child_wasm(this.tree[0], index);
    return unmarshalNode(this.tree);
  }
  /**
   * Get this node's child with the given numerical field id.
   *
   * See also {@link Node#childForFieldName}. You can
   * convert a field name to an id using {@link Language#fieldIdForName}.
   */
  childForFieldId(fieldId) {
    marshalNode(this);
    C._ts_node_child_by_field_id_wasm(this.tree[0], fieldId);
    return unmarshalNode(this.tree);
  }
  /**
   * Get the first child with the given field name.
   *
   * If multiple children may have the same field name, access them using
   * {@link Node#childrenForFieldName}.
   */
  childForFieldName(fieldName) {
    const fieldId = this.tree.language.fields.indexOf(fieldName);
    if (fieldId !== -1) return this.childForFieldId(fieldId);
    return null;
  }
  /** Get the field name of this node's child at the given index. */
  fieldNameForChild(index) {
    marshalNode(this);
    const address = C._ts_node_field_name_for_child_wasm(this.tree[0], index);
    if (!address) return null;
    return C.AsciiToString(address);
  }
  /** Get the field name of this node's named child at the given index. */
  fieldNameForNamedChild(index) {
    marshalNode(this);
    const address = C._ts_node_field_name_for_named_child_wasm(this.tree[0], index);
    if (!address) return null;
    return C.AsciiToString(address);
  }
  /**
   * Get an array of this node's children with a given field name.
   *
   * See also {@link Node#children}.
   */
  childrenForFieldName(fieldName) {
    const fieldId = this.tree.language.fields.indexOf(fieldName);
    if (fieldId !== -1 && fieldId !== 0) return this.childrenForFieldId(fieldId);
    return [];
  }
  /**
    * Get an array of this node's children with a given field id.
    *
    * See also {@link Node#childrenForFieldName}.
    */
  childrenForFieldId(fieldId) {
    marshalNode(this);
    C._ts_node_children_by_field_id_wasm(this.tree[0], fieldId);
    const count = C.getValue(TRANSFER_BUFFER, "i32");
    const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
    const result = new Array(count);
    if (count > 0) {
      let address = buffer;
      for (let i2 = 0; i2 < count; i2++) {
        result[i2] = unmarshalNode(this.tree, address);
        address += SIZE_OF_NODE;
      }
      C._free(buffer);
    }
    return result;
  }
  /** Get the node's first child that contains or starts after the given byte offset. */
  firstChildForIndex(index) {
    marshalNode(this);
    const address = TRANSFER_BUFFER + SIZE_OF_NODE;
    C.setValue(address, index, "i32");
    C._ts_node_first_child_for_byte_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }
  /** Get the node's first named child that contains or starts after the given byte offset. */
  firstNamedChildForIndex(index) {
    marshalNode(this);
    const address = TRANSFER_BUFFER + SIZE_OF_NODE;
    C.setValue(address, index, "i32");
    C._ts_node_first_named_child_for_byte_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }
  /** Get this node's number of children. */
  get childCount() {
    marshalNode(this);
    return C._ts_node_child_count_wasm(this.tree[0]);
  }
  /**
   * Get this node's number of *named* children.
   *
   * See also {@link Node#isNamed}.
   */
  get namedChildCount() {
    marshalNode(this);
    return C._ts_node_named_child_count_wasm(this.tree[0]);
  }
  /** Get this node's first child. */
  get firstChild() {
    return this.child(0);
  }
  /**
   * Get this node's first named child.
   *
   * See also {@link Node#isNamed}.
   */
  get firstNamedChild() {
    return this.namedChild(0);
  }
  /** Get this node's last child. */
  get lastChild() {
    return this.child(this.childCount - 1);
  }
  /**
   * Get this node's last named child.
   *
   * See also {@link Node#isNamed}.
   */
  get lastNamedChild() {
    return this.namedChild(this.namedChildCount - 1);
  }
  /**
   * Iterate over this node's children.
   *
   * If you're walking the tree recursively, you may want to use the
   * {@link TreeCursor} APIs directly instead.
   */
  get children() {
    if (!this._children) {
      marshalNode(this);
      C._ts_node_children_wasm(this.tree[0]);
      const count = C.getValue(TRANSFER_BUFFER, "i32");
      const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
      this._children = new Array(count);
      if (count > 0) {
        let address = buffer;
        for (let i2 = 0; i2 < count; i2++) {
          this._children[i2] = unmarshalNode(this.tree, address);
          address += SIZE_OF_NODE;
        }
        C._free(buffer);
      }
    }
    return this._children;
  }
  /**
   * Iterate over this node's named children.
   *
   * See also {@link Node#children}.
   */
  get namedChildren() {
    if (!this._namedChildren) {
      marshalNode(this);
      C._ts_node_named_children_wasm(this.tree[0]);
      const count = C.getValue(TRANSFER_BUFFER, "i32");
      const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
      this._namedChildren = new Array(count);
      if (count > 0) {
        let address = buffer;
        for (let i2 = 0; i2 < count; i2++) {
          this._namedChildren[i2] = unmarshalNode(this.tree, address);
          address += SIZE_OF_NODE;
        }
        C._free(buffer);
      }
    }
    return this._namedChildren;
  }
  /**
   * Get the descendants of this node that are the given type, or in the given types array.
   *
   * The types array should contain node type strings, which can be retrieved from {@link Language#types}.
   *
   * Additionally, a `startPosition` and `endPosition` can be passed in to restrict the search to a byte range.
   */
  descendantsOfType(types, startPosition = ZERO_POINT, endPosition = ZERO_POINT) {
    if (!Array.isArray(types)) types = [types];
    const symbols = [];
    const typesBySymbol = this.tree.language.types;
    for (const node_type of types) {
      if (node_type == "ERROR") {
        symbols.push(65535);
      }
    }
    for (let i2 = 0, n = typesBySymbol.length; i2 < n; i2++) {
      if (types.includes(typesBySymbol[i2])) {
        symbols.push(i2);
      }
    }
    const symbolsAddress = C._malloc(SIZE_OF_INT * symbols.length);
    for (let i2 = 0, n = symbols.length; i2 < n; i2++) {
      C.setValue(symbolsAddress + i2 * SIZE_OF_INT, symbols[i2], "i32");
    }
    marshalNode(this);
    C._ts_node_descendants_of_type_wasm(
      this.tree[0],
      symbolsAddress,
      symbols.length,
      startPosition.row,
      startPosition.column,
      endPosition.row,
      endPosition.column
    );
    const descendantCount = C.getValue(TRANSFER_BUFFER, "i32");
    const descendantAddress = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
    const result = new Array(descendantCount);
    if (descendantCount > 0) {
      let address = descendantAddress;
      for (let i2 = 0; i2 < descendantCount; i2++) {
        result[i2] = unmarshalNode(this.tree, address);
        address += SIZE_OF_NODE;
      }
    }
    C._free(descendantAddress);
    C._free(symbolsAddress);
    return result;
  }
  /** Get this node's next sibling. */
  get nextSibling() {
    marshalNode(this);
    C._ts_node_next_sibling_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }
  /** Get this node's previous sibling. */
  get previousSibling() {
    marshalNode(this);
    C._ts_node_prev_sibling_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }
  /**
   * Get this node's next *named* sibling.
   *
   * See also {@link Node#isNamed}.
   */
  get nextNamedSibling() {
    marshalNode(this);
    C._ts_node_next_named_sibling_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }
  /**
   * Get this node's previous *named* sibling.
   *
   * See also {@link Node#isNamed}.
   */
  get previousNamedSibling() {
    marshalNode(this);
    C._ts_node_prev_named_sibling_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }
  /** Get the node's number of descendants, including one for the node itself. */
  get descendantCount() {
    marshalNode(this);
    return C._ts_node_descendant_count_wasm(this.tree[0]);
  }
  /**
   * Get this node's immediate parent.
   * Prefer {@link Node#childWithDescendant} for iterating over this node's ancestors.
   */
  get parent() {
    marshalNode(this);
    C._ts_node_parent_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }
  /**
   * Get the node that contains `descendant`.
   *
   * Note that this can return `descendant` itself.
   */
  childWithDescendant(descendant) {
    marshalNode(this);
    marshalNode(descendant, 1);
    C._ts_node_child_with_descendant_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }
  /** Get the smallest node within this node that spans the given byte range. */
  descendantForIndex(start2, end = start2) {
    if (typeof start2 !== "number" || typeof end !== "number") {
      throw new Error("Arguments must be numbers");
    }
    marshalNode(this);
    const address = TRANSFER_BUFFER + SIZE_OF_NODE;
    C.setValue(address, start2, "i32");
    C.setValue(address + SIZE_OF_INT, end, "i32");
    C._ts_node_descendant_for_index_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }
  /** Get the smallest named node within this node that spans the given byte range. */
  namedDescendantForIndex(start2, end = start2) {
    if (typeof start2 !== "number" || typeof end !== "number") {
      throw new Error("Arguments must be numbers");
    }
    marshalNode(this);
    const address = TRANSFER_BUFFER + SIZE_OF_NODE;
    C.setValue(address, start2, "i32");
    C.setValue(address + SIZE_OF_INT, end, "i32");
    C._ts_node_named_descendant_for_index_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }
  /** Get the smallest node within this node that spans the given point range. */
  descendantForPosition(start2, end = start2) {
    if (!isPoint(start2) || !isPoint(end)) {
      throw new Error("Arguments must be {row, column} objects");
    }
    marshalNode(this);
    const address = TRANSFER_BUFFER + SIZE_OF_NODE;
    marshalPoint(address, start2);
    marshalPoint(address + SIZE_OF_POINT, end);
    C._ts_node_descendant_for_position_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }
  /** Get the smallest named node within this node that spans the given point range. */
  namedDescendantForPosition(start2, end = start2) {
    if (!isPoint(start2) || !isPoint(end)) {
      throw new Error("Arguments must be {row, column} objects");
    }
    marshalNode(this);
    const address = TRANSFER_BUFFER + SIZE_OF_NODE;
    marshalPoint(address, start2);
    marshalPoint(address + SIZE_OF_POINT, end);
    C._ts_node_named_descendant_for_position_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }
  /**
   * Create a new {@link TreeCursor} starting from this node.
   *
   * Note that the given node is considered the root of the cursor,
   * and the cursor cannot walk outside this node.
   */
  walk() {
    marshalNode(this);
    C._ts_tree_cursor_new_wasm(this.tree[0]);
    return new TreeCursor(INTERNAL, this.tree);
  }
  /**
   * Edit this node to keep it in-sync with source code that has been edited.
   *
   * This function is only rarely needed. When you edit a syntax tree with
   * the {@link Tree#edit} method, all of the nodes that you retrieve from
   * the tree afterward will already reflect the edit. You only need to
   * use {@link Node#edit} when you have a specific {@link Node} instance that
   * you want to keep and continue to use after an edit.
   */
  edit(edit) {
    if (this.startIndex >= edit.oldEndIndex) {
      this.startIndex = edit.newEndIndex + (this.startIndex - edit.oldEndIndex);
      let subbedPointRow;
      let subbedPointColumn;
      if (this.startPosition.row > edit.oldEndPosition.row) {
        subbedPointRow = this.startPosition.row - edit.oldEndPosition.row;
        subbedPointColumn = this.startPosition.column;
      } else {
        subbedPointRow = 0;
        subbedPointColumn = this.startPosition.column;
        if (this.startPosition.column >= edit.oldEndPosition.column) {
          subbedPointColumn = this.startPosition.column - edit.oldEndPosition.column;
        }
      }
      if (subbedPointRow > 0) {
        this.startPosition.row += subbedPointRow;
        this.startPosition.column = subbedPointColumn;
      } else {
        this.startPosition.column += subbedPointColumn;
      }
    } else if (this.startIndex > edit.startIndex) {
      this.startIndex = edit.newEndIndex;
      this.startPosition.row = edit.newEndPosition.row;
      this.startPosition.column = edit.newEndPosition.column;
    }
  }
  /** Get the S-expression representation of this node. */
  toString() {
    marshalNode(this);
    const address = C._ts_node_to_string_wasm(this.tree[0]);
    const result = C.AsciiToString(address);
    C._free(address);
    return result;
  }
};
function unmarshalCaptures(query, tree, address, patternIndex, result) {
  for (let i2 = 0, n = result.length; i2 < n; i2++) {
    const captureIndex = C.getValue(address, "i32");
    address += SIZE_OF_INT;
    const node = unmarshalNode(tree, address);
    address += SIZE_OF_NODE;
    result[i2] = { patternIndex, name: query.captureNames[captureIndex], node };
  }
  return address;
}
__name(unmarshalCaptures, "unmarshalCaptures");
function marshalNode(node, index = 0) {
  let address = TRANSFER_BUFFER + index * SIZE_OF_NODE;
  C.setValue(address, node.id, "i32");
  address += SIZE_OF_INT;
  C.setValue(address, node.startIndex, "i32");
  address += SIZE_OF_INT;
  C.setValue(address, node.startPosition.row, "i32");
  address += SIZE_OF_INT;
  C.setValue(address, node.startPosition.column, "i32");
  address += SIZE_OF_INT;
  C.setValue(address, node[0], "i32");
}
__name(marshalNode, "marshalNode");
function unmarshalNode(tree, address = TRANSFER_BUFFER) {
  const id = C.getValue(address, "i32");
  address += SIZE_OF_INT;
  if (id === 0) return null;
  const index = C.getValue(address, "i32");
  address += SIZE_OF_INT;
  const row = C.getValue(address, "i32");
  address += SIZE_OF_INT;
  const column = C.getValue(address, "i32");
  address += SIZE_OF_INT;
  const other = C.getValue(address, "i32");
  const result = new Node(INTERNAL, {
    id,
    tree,
    startIndex: index,
    startPosition: { row, column },
    other
  });
  return result;
}
__name(unmarshalNode, "unmarshalNode");
function marshalTreeCursor(cursor, address = TRANSFER_BUFFER) {
  C.setValue(address + 0 * SIZE_OF_INT, cursor[0], "i32");
  C.setValue(address + 1 * SIZE_OF_INT, cursor[1], "i32");
  C.setValue(address + 2 * SIZE_OF_INT, cursor[2], "i32");
  C.setValue(address + 3 * SIZE_OF_INT, cursor[3], "i32");
}
__name(marshalTreeCursor, "marshalTreeCursor");
function unmarshalTreeCursor(cursor) {
  cursor[0] = C.getValue(TRANSFER_BUFFER + 0 * SIZE_OF_INT, "i32");
  cursor[1] = C.getValue(TRANSFER_BUFFER + 1 * SIZE_OF_INT, "i32");
  cursor[2] = C.getValue(TRANSFER_BUFFER + 2 * SIZE_OF_INT, "i32");
  cursor[3] = C.getValue(TRANSFER_BUFFER + 3 * SIZE_OF_INT, "i32");
}
__name(unmarshalTreeCursor, "unmarshalTreeCursor");
function marshalPoint(address, point) {
  C.setValue(address, point.row, "i32");
  C.setValue(address + SIZE_OF_INT, point.column, "i32");
}
__name(marshalPoint, "marshalPoint");
function unmarshalPoint(address) {
  const result = {
    row: C.getValue(address, "i32") >>> 0,
    column: C.getValue(address + SIZE_OF_INT, "i32") >>> 0
  };
  return result;
}
__name(unmarshalPoint, "unmarshalPoint");
function marshalRange(address, range) {
  marshalPoint(address, range.startPosition);
  address += SIZE_OF_POINT;
  marshalPoint(address, range.endPosition);
  address += SIZE_OF_POINT;
  C.setValue(address, range.startIndex, "i32");
  address += SIZE_OF_INT;
  C.setValue(address, range.endIndex, "i32");
  address += SIZE_OF_INT;
}
__name(marshalRange, "marshalRange");
function unmarshalRange(address) {
  const result = {};
  result.startPosition = unmarshalPoint(address);
  address += SIZE_OF_POINT;
  result.endPosition = unmarshalPoint(address);
  address += SIZE_OF_POINT;
  result.startIndex = C.getValue(address, "i32") >>> 0;
  address += SIZE_OF_INT;
  result.endIndex = C.getValue(address, "i32") >>> 0;
  return result;
}
__name(unmarshalRange, "unmarshalRange");
function marshalEdit(edit, address = TRANSFER_BUFFER) {
  marshalPoint(address, edit.startPosition);
  address += SIZE_OF_POINT;
  marshalPoint(address, edit.oldEndPosition);
  address += SIZE_OF_POINT;
  marshalPoint(address, edit.newEndPosition);
  address += SIZE_OF_POINT;
  C.setValue(address, edit.startIndex, "i32");
  address += SIZE_OF_INT;
  C.setValue(address, edit.oldEndIndex, "i32");
  address += SIZE_OF_INT;
  C.setValue(address, edit.newEndIndex, "i32");
  address += SIZE_OF_INT;
}
__name(marshalEdit, "marshalEdit");
function unmarshalLanguageMetadata(address) {
  const major_version = C.getValue(address, "i32");
  const minor_version = C.getValue(address += SIZE_OF_INT, "i32");
  const patch_version = C.getValue(address += SIZE_OF_INT, "i32");
  return { major_version, minor_version, patch_version };
}
__name(unmarshalLanguageMetadata, "unmarshalLanguageMetadata");
var LANGUAGE_FUNCTION_REGEX = /^tree_sitter_\w+$/;
var Language = class _Language {
  static {
    __name(this, "Language");
  }
  /** @internal */
  [0] = 0;
  // Internal handle for Wasm
  /**
   * A list of all node types in the language. The index of each type in this
   * array is its node type id.
   */
  types;
  /**
   * A list of all field names in the language. The index of each field name in
   * this array is its field id.
   */
  fields;
  /** @internal */
  constructor(internal, address) {
    assertInternal(internal);
    this[0] = address;
    this.types = new Array(C._ts_language_symbol_count(this[0]));
    for (let i2 = 0, n = this.types.length; i2 < n; i2++) {
      if (C._ts_language_symbol_type(this[0], i2) < 2) {
        this.types[i2] = C.UTF8ToString(C._ts_language_symbol_name(this[0], i2));
      }
    }
    this.fields = new Array(C._ts_language_field_count(this[0]) + 1);
    for (let i2 = 0, n = this.fields.length; i2 < n; i2++) {
      const fieldName = C._ts_language_field_name_for_id(this[0], i2);
      if (fieldName !== 0) {
        this.fields[i2] = C.UTF8ToString(fieldName);
      } else {
        this.fields[i2] = null;
      }
    }
  }
  /**
   * Gets the name of the language.
   */
  get name() {
    const ptr = C._ts_language_name(this[0]);
    if (ptr === 0) return null;
    return C.UTF8ToString(ptr);
  }
  /**
   * Gets the ABI version of the language.
   */
  get abiVersion() {
    return C._ts_language_abi_version(this[0]);
  }
  /**
  * Get the metadata for this language. This information is generated by the
  * CLI, and relies on the language author providing the correct metadata in
  * the language's `tree-sitter.json` file.
  */
  get metadata() {
    C._ts_language_metadata_wasm(this[0]);
    const length = C.getValue(TRANSFER_BUFFER, "i32");
    if (length === 0) return null;
    return unmarshalLanguageMetadata(TRANSFER_BUFFER + SIZE_OF_INT);
  }
  /**
   * Gets the number of fields in the language.
   */
  get fieldCount() {
    return this.fields.length - 1;
  }
  /**
   * Gets the number of states in the language.
   */
  get stateCount() {
    return C._ts_language_state_count(this[0]);
  }
  /**
   * Get the field id for a field name.
   */
  fieldIdForName(fieldName) {
    const result = this.fields.indexOf(fieldName);
    return result !== -1 ? result : null;
  }
  /**
   * Get the field name for a field id.
   */
  fieldNameForId(fieldId) {
    return this.fields[fieldId] ?? null;
  }
  /**
   * Get the node type id for a node type name.
   */
  idForNodeType(type, named2) {
    const typeLength = C.lengthBytesUTF8(type);
    const typeAddress = C._malloc(typeLength + 1);
    C.stringToUTF8(type, typeAddress, typeLength + 1);
    const result = C._ts_language_symbol_for_name(this[0], typeAddress, typeLength, named2 ? 1 : 0);
    C._free(typeAddress);
    return result || null;
  }
  /**
   * Gets the number of node types in the language.
   */
  get nodeTypeCount() {
    return C._ts_language_symbol_count(this[0]);
  }
  /**
   * Get the node type name for a node type id.
   */
  nodeTypeForId(typeId) {
    const name2 = C._ts_language_symbol_name(this[0], typeId);
    return name2 ? C.UTF8ToString(name2) : null;
  }
  /**
   * Check if a node type is named.
   *
   * @see {@link https://tree-sitter.github.io/tree-sitter/using-parsers/2-basic-parsing.html#named-vs-anonymous-nodes}
   */
  nodeTypeIsNamed(typeId) {
    return C._ts_language_type_is_named_wasm(this[0], typeId) ? true : false;
  }
  /**
   * Check if a node type is visible.
   */
  nodeTypeIsVisible(typeId) {
    return C._ts_language_type_is_visible_wasm(this[0], typeId) ? true : false;
  }
  /**
   * Get the supertypes ids of this language.
   *
   * @see {@link https://tree-sitter.github.io/tree-sitter/using-parsers/6-static-node-types.html?highlight=supertype#supertype-nodes}
   */
  get supertypes() {
    C._ts_language_supertypes_wasm(this[0]);
    const count = C.getValue(TRANSFER_BUFFER, "i32");
    const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
    const result = new Array(count);
    if (count > 0) {
      let address = buffer;
      for (let i2 = 0; i2 < count; i2++) {
        result[i2] = C.getValue(address, "i16");
        address += SIZE_OF_SHORT;
      }
    }
    return result;
  }
  /**
   * Get the subtype ids for a given supertype node id.
   */
  subtypes(supertype) {
    C._ts_language_subtypes_wasm(this[0], supertype);
    const count = C.getValue(TRANSFER_BUFFER, "i32");
    const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
    const result = new Array(count);
    if (count > 0) {
      let address = buffer;
      for (let i2 = 0; i2 < count; i2++) {
        result[i2] = C.getValue(address, "i16");
        address += SIZE_OF_SHORT;
      }
    }
    return result;
  }
  /**
   * Get the next state id for a given state id and node type id.
   */
  nextState(stateId, typeId) {
    return C._ts_language_next_state(this[0], stateId, typeId);
  }
  /**
   * Create a new lookahead iterator for this language and parse state.
   *
   * This returns `null` if state is invalid for this language.
   *
   * Iterating {@link LookaheadIterator} will yield valid symbols in the given
   * parse state. A newly created iterator is not positioned on a symbol, so
   * {@link LookaheadIterator#currentType} returns `null` until the first
   * iteration step.
   *
   * Lookahead iterators can be useful for generating suggestions and improving
   * syntax error diagnostics. To get symbols valid in an `ERROR` node, use the
   * lookahead iterator on its first leaf node state. For `MISSING` nodes, a
   * lookahead iterator created on the previous non-extra leaf node may be
   * appropriate.
   */
  lookaheadIterator(stateId) {
    const address = C._ts_lookahead_iterator_new(this[0], stateId);
    if (address) return new LookaheadIterator(INTERNAL, address, this);
    return null;
  }
  /**
   * Load a language from a WebAssembly module.
   * The module can be provided as a path to a file, a `URL` to a file, or as a
   * buffer.
   */
  static async load(input) {
    let binary2;
    if (input instanceof Uint8Array) {
      binary2 = input;
    } else if (globalThis.process?.versions.node) {
      const fs2 = await import("fs/promises");
      binary2 = await fs2.readFile(input);
    } else {
      const response = await fetch(input);
      if (!response.ok) {
        const body2 = await response.text();
        throw new Error(`Language.load failed with status ${response.status}.

${body2}`);
      }
      const retryResp = response.clone();
      try {
        binary2 = await WebAssembly.compileStreaming(response);
      } catch (reason) {
        console.error("wasm streaming compile failed:", reason);
        console.error("falling back to ArrayBuffer instantiation");
        binary2 = new Uint8Array(await retryResp.arrayBuffer());
      }
    }
    const mod = await C.loadWebAssemblyModule(binary2, { loadAsync: true });
    return _Language.loadFromWasmExports(mod, { sync: false });
  }
  static loadFromWasmExports(mod, { sync }) {
    const symbolNames = Object.keys(mod);
    const functionName = symbolNames.find((key) => LANGUAGE_FUNCTION_REGEX.test(key) && !key.includes("external_scanner_"));
    if (!functionName) {
      console.log(`Couldn't find language function in Wasm file. Symbols:
${JSON.stringify(symbolNames, null, 2)}`);
      throw new Error(`Language.${sync ? "loadSync" : "load"} failed: no language function found in Wasm file`);
    }
    const languageAddress = mod[functionName]();
    return new _Language(INTERNAL, languageAddress);
  }
  /**
   * Load a language synchronously from a pre-compiled WebAssembly module.
   * Use this when the host environment provides a `WebAssembly.Module` directly.
   */
  static loadSync(wasmModule) {
    const mod = C.loadWebAssemblyModule(wasmModule, { loadAsync: false });
    return _Language.loadFromWasmExports(mod, { sync: true });
  }
};
async function Module2(moduleArg = {}) {
  var moduleRtn;
  var Module = moduleArg;
  var ENVIRONMENT_IS_WEB = typeof window == "object";
  var ENVIRONMENT_IS_WORKER = typeof WorkerGlobalScope != "undefined";
  var ENVIRONMENT_IS_NODE = typeof process == "object" && process.versions?.node && process.type != "renderer";
  if (ENVIRONMENT_IS_NODE) {
    const { createRequire } = await import("module");
    var require = createRequire(import.meta.url);
  }
  Module.currentQueryProgressCallback = null;
  Module.currentProgressCallback = null;
  Module.currentLogCallback = null;
  Module.currentParseCallback = null;
  var arguments_ = [];
  var thisProgram = "./this.program";
  var quit_ = /* @__PURE__ */ __name((status, toThrow) => {
    throw toThrow;
  }, "quit_");
  var _scriptName = import.meta.url;
  var scriptDirectory = "";
  function locateFile(path2) {
    if (Module["locateFile"]) {
      return Module["locateFile"](path2, scriptDirectory);
    }
    return scriptDirectory + path2;
  }
  __name(locateFile, "locateFile");
  var readAsync, readBinary;
  if (ENVIRONMENT_IS_NODE) {
    var fs = require("fs");
    if (_scriptName.startsWith("file:")) {
      scriptDirectory = require("path").dirname(require("url").fileURLToPath(_scriptName)) + "/";
    }
    readBinary = /* @__PURE__ */ __name((filename) => {
      filename = isFileURI(filename) ? new URL(filename) : filename;
      var ret = fs.readFileSync(filename);
      return ret;
    }, "readBinary");
    readAsync = /* @__PURE__ */ __name(async (filename, binary2 = true) => {
      filename = isFileURI(filename) ? new URL(filename) : filename;
      var ret = fs.readFileSync(filename, binary2 ? void 0 : "utf8");
      return ret;
    }, "readAsync");
    if (process.argv.length > 1) {
      thisProgram = process.argv[1].replace(/\\/g, "/");
    }
    arguments_ = process.argv.slice(2);
    quit_ = /* @__PURE__ */ __name((status, toThrow) => {
      process.exitCode = status;
      throw toThrow;
    }, "quit_");
  } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
    try {
      scriptDirectory = new URL(".", _scriptName).href;
    } catch {
    }
    {
      if (ENVIRONMENT_IS_WORKER) {
        readBinary = /* @__PURE__ */ __name((url) => {
          var xhr = new XMLHttpRequest();
          xhr.open("GET", url, false);
          xhr.responseType = "arraybuffer";
          xhr.send(null);
          return new Uint8Array(
            /** @type{!ArrayBuffer} */
            xhr.response
          );
        }, "readBinary");
      }
      readAsync = /* @__PURE__ */ __name(async (url) => {
        if (isFileURI(url)) {
          return new Promise((resolve, reject) => {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", url, true);
            xhr.responseType = "arraybuffer";
            xhr.onload = () => {
              if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                resolve(xhr.response);
                return;
              }
              reject(xhr.status);
            };
            xhr.onerror = reject;
            xhr.send(null);
          });
        }
        var response = await fetch(url, {
          credentials: "same-origin"
        });
        if (response.ok) {
          return response.arrayBuffer();
        }
        throw new Error(response.status + " : " + response.url);
      }, "readAsync");
    }
  } else {
  }
  var out = console.log.bind(console);
  var err = console.error.bind(console);
  var dynamicLibraries = [];
  var wasmBinary;
  var ABORT = false;
  var EXITSTATUS;
  var isFileURI = /* @__PURE__ */ __name((filename) => filename.startsWith("file://"), "isFileURI");
  var readyPromiseResolve, readyPromiseReject;
  var wasmMemory;
  var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
  var HEAP64, HEAPU64;
  var HEAP_DATA_VIEW;
  var runtimeInitialized = false;
  function updateMemoryViews() {
    var b = wasmMemory.buffer;
    Module["HEAP8"] = HEAP8 = new Int8Array(b);
    Module["HEAP16"] = HEAP16 = new Int16Array(b);
    Module["HEAPU8"] = HEAPU8 = new Uint8Array(b);
    Module["HEAPU16"] = HEAPU16 = new Uint16Array(b);
    Module["HEAP32"] = HEAP32 = new Int32Array(b);
    Module["HEAPU32"] = HEAPU32 = new Uint32Array(b);
    Module["HEAPF32"] = HEAPF32 = new Float32Array(b);
    Module["HEAPF64"] = HEAPF64 = new Float64Array(b);
    Module["HEAP64"] = HEAP64 = new BigInt64Array(b);
    Module["HEAPU64"] = HEAPU64 = new BigUint64Array(b);
    Module["HEAP_DATA_VIEW"] = HEAP_DATA_VIEW = new DataView(b);
    LE_HEAP_UPDATE();
  }
  __name(updateMemoryViews, "updateMemoryViews");
  function initMemory() {
    if (Module["wasmMemory"]) {
      wasmMemory = Module["wasmMemory"];
    } else {
      var INITIAL_MEMORY = Module["INITIAL_MEMORY"] || 33554432;
      wasmMemory = new WebAssembly.Memory({
        "initial": INITIAL_MEMORY / 65536,
        // In theory we should not need to emit the maximum if we want "unlimited"
        // or 4GB of memory, but VMs error on that atm, see
        // https://github.com/emscripten-core/emscripten/issues/14130
        // And in the pthreads case we definitely need to emit a maximum. So
        // always emit one.
        "maximum": 32768
      });
    }
    updateMemoryViews();
  }
  __name(initMemory, "initMemory");
  var __RELOC_FUNCS__ = [];
  function preRun() {
    if (Module["preRun"]) {
      if (typeof Module["preRun"] == "function") Module["preRun"] = [Module["preRun"]];
      while (Module["preRun"].length) {
        addOnPreRun(Module["preRun"].shift());
      }
    }
    callRuntimeCallbacks(onPreRuns);
  }
  __name(preRun, "preRun");
  function initRuntime() {
    runtimeInitialized = true;
    callRuntimeCallbacks(__RELOC_FUNCS__);
    wasmExports["__wasm_call_ctors"]();
    callRuntimeCallbacks(onPostCtors);
  }
  __name(initRuntime, "initRuntime");
  function preMain() {
  }
  __name(preMain, "preMain");
  function postRun() {
    if (Module["postRun"]) {
      if (typeof Module["postRun"] == "function") Module["postRun"] = [Module["postRun"]];
      while (Module["postRun"].length) {
        addOnPostRun(Module["postRun"].shift());
      }
    }
    callRuntimeCallbacks(onPostRuns);
  }
  __name(postRun, "postRun");
  function abort(what) {
    Module["onAbort"]?.(what);
    what = "Aborted(" + what + ")";
    err(what);
    ABORT = true;
    what += ". Build with -sASSERTIONS for more info.";
    var e = new WebAssembly.RuntimeError(what);
    readyPromiseReject?.(e);
    throw e;
  }
  __name(abort, "abort");
  var wasmBinaryFile;
  function findWasmBinary() {
    if (Module["locateFile"]) {
      return locateFile("web-tree-sitter.wasm");
    }
    return new URL("web-tree-sitter.wasm", import.meta.url).href;
  }
  __name(findWasmBinary, "findWasmBinary");
  function getBinarySync(file) {
    if (file == wasmBinaryFile && wasmBinary) {
      return new Uint8Array(wasmBinary);
    }
    if (readBinary) {
      return readBinary(file);
    }
    throw "both async and sync fetching of the wasm failed";
  }
  __name(getBinarySync, "getBinarySync");
  async function getWasmBinary(binaryFile) {
    if (!wasmBinary) {
      try {
        var response = await readAsync(binaryFile);
        return new Uint8Array(response);
      } catch {
      }
    }
    return getBinarySync(binaryFile);
  }
  __name(getWasmBinary, "getWasmBinary");
  async function instantiateArrayBuffer(binaryFile, imports) {
    try {
      var binary2 = await getWasmBinary(binaryFile);
      var instance2 = await WebAssembly.instantiate(binary2, imports);
      return instance2;
    } catch (reason) {
      err(`failed to asynchronously prepare wasm: ${reason}`);
      abort(reason);
    }
  }
  __name(instantiateArrayBuffer, "instantiateArrayBuffer");
  async function instantiateAsync(binary2, binaryFile, imports) {
    if (!binary2 && !isFileURI(binaryFile) && !ENVIRONMENT_IS_NODE) {
      try {
        var response = fetch(binaryFile, {
          credentials: "same-origin"
        });
        var instantiationResult = await WebAssembly.instantiateStreaming(response, imports);
        return instantiationResult;
      } catch (reason) {
        err(`wasm streaming compile failed: ${reason}`);
        err("falling back to ArrayBuffer instantiation");
      }
    }
    return instantiateArrayBuffer(binaryFile, imports);
  }
  __name(instantiateAsync, "instantiateAsync");
  function getWasmImports() {
    return {
      "env": wasmImports,
      "wasi_snapshot_preview1": wasmImports,
      "GOT.mem": new Proxy(wasmImports, GOTHandler),
      "GOT.func": new Proxy(wasmImports, GOTHandler)
    };
  }
  __name(getWasmImports, "getWasmImports");
  async function createWasm() {
    function receiveInstance(instance2, module2) {
      wasmExports = instance2.exports;
      wasmExports = relocateExports(wasmExports, 1024);
      var metadata2 = getDylinkMetadata(module2);
      if (metadata2.neededDynlibs) {
        dynamicLibraries = metadata2.neededDynlibs.concat(dynamicLibraries);
      }
      mergeLibSymbols(wasmExports, "main");
      LDSO.init();
      loadDylibs();
      __RELOC_FUNCS__.push(wasmExports["__wasm_apply_data_relocs"]);
      assignWasmExports(wasmExports);
      return wasmExports;
    }
    __name(receiveInstance, "receiveInstance");
    function receiveInstantiationResult(result2) {
      return receiveInstance(result2["instance"], result2["module"]);
    }
    __name(receiveInstantiationResult, "receiveInstantiationResult");
    var info2 = getWasmImports();
    if (Module["instantiateWasm"]) {
      return new Promise((resolve, reject) => {
        Module["instantiateWasm"](info2, (mod, inst) => {
          resolve(receiveInstance(mod, inst));
        });
      });
    }
    wasmBinaryFile ??= findWasmBinary();
    var result = await instantiateAsync(wasmBinary, wasmBinaryFile, info2);
    var exports = receiveInstantiationResult(result);
    return exports;
  }
  __name(createWasm, "createWasm");
  class ExitStatus {
    static {
      __name(this, "ExitStatus");
    }
    name = "ExitStatus";
    constructor(status) {
      this.message = `Program terminated with exit(${status})`;
      this.status = status;
    }
  }
  var GOT = {};
  var currentModuleWeakSymbols = /* @__PURE__ */ new Set([]);
  var GOTHandler = {
    get(obj, symName) {
      var rtn = GOT[symName];
      if (!rtn) {
        rtn = GOT[symName] = new WebAssembly.Global({
          "value": "i32",
          "mutable": true
        });
      }
      if (!currentModuleWeakSymbols.has(symName)) {
        rtn.required = true;
      }
      return rtn;
    }
  };
  var LE_ATOMICS_NATIVE_BYTE_ORDER = [];
  var LE_HEAP_LOAD_F32 = /* @__PURE__ */ __name((byteOffset) => HEAP_DATA_VIEW.getFloat32(byteOffset, true), "LE_HEAP_LOAD_F32");
  var LE_HEAP_LOAD_F64 = /* @__PURE__ */ __name((byteOffset) => HEAP_DATA_VIEW.getFloat64(byteOffset, true), "LE_HEAP_LOAD_F64");
  var LE_HEAP_LOAD_I16 = /* @__PURE__ */ __name((byteOffset) => HEAP_DATA_VIEW.getInt16(byteOffset, true), "LE_HEAP_LOAD_I16");
  var LE_HEAP_LOAD_I32 = /* @__PURE__ */ __name((byteOffset) => HEAP_DATA_VIEW.getInt32(byteOffset, true), "LE_HEAP_LOAD_I32");
  var LE_HEAP_LOAD_I64 = /* @__PURE__ */ __name((byteOffset) => HEAP_DATA_VIEW.getBigInt64(byteOffset, true), "LE_HEAP_LOAD_I64");
  var LE_HEAP_LOAD_U32 = /* @__PURE__ */ __name((byteOffset) => HEAP_DATA_VIEW.getUint32(byteOffset, true), "LE_HEAP_LOAD_U32");
  var LE_HEAP_STORE_F32 = /* @__PURE__ */ __name((byteOffset, value) => HEAP_DATA_VIEW.setFloat32(byteOffset, value, true), "LE_HEAP_STORE_F32");
  var LE_HEAP_STORE_F64 = /* @__PURE__ */ __name((byteOffset, value) => HEAP_DATA_VIEW.setFloat64(byteOffset, value, true), "LE_HEAP_STORE_F64");
  var LE_HEAP_STORE_I16 = /* @__PURE__ */ __name((byteOffset, value) => HEAP_DATA_VIEW.setInt16(byteOffset, value, true), "LE_HEAP_STORE_I16");
  var LE_HEAP_STORE_I32 = /* @__PURE__ */ __name((byteOffset, value) => HEAP_DATA_VIEW.setInt32(byteOffset, value, true), "LE_HEAP_STORE_I32");
  var LE_HEAP_STORE_I64 = /* @__PURE__ */ __name((byteOffset, value) => HEAP_DATA_VIEW.setBigInt64(byteOffset, value, true), "LE_HEAP_STORE_I64");
  var LE_HEAP_STORE_U32 = /* @__PURE__ */ __name((byteOffset, value) => HEAP_DATA_VIEW.setUint32(byteOffset, value, true), "LE_HEAP_STORE_U32");
  var callRuntimeCallbacks = /* @__PURE__ */ __name((callbacks) => {
    while (callbacks.length > 0) {
      callbacks.shift()(Module);
    }
  }, "callRuntimeCallbacks");
  var onPostRuns = [];
  var addOnPostRun = /* @__PURE__ */ __name((cb) => onPostRuns.push(cb), "addOnPostRun");
  var onPreRuns = [];
  var addOnPreRun = /* @__PURE__ */ __name((cb) => onPreRuns.push(cb), "addOnPreRun");
  var UTF8Decoder = typeof TextDecoder != "undefined" ? new TextDecoder() : void 0;
  var findStringEnd = /* @__PURE__ */ __name((heapOrArray, idx, maxBytesToRead, ignoreNul) => {
    var maxIdx = idx + maxBytesToRead;
    if (ignoreNul) return maxIdx;
    while (heapOrArray[idx] && !(idx >= maxIdx)) ++idx;
    return idx;
  }, "findStringEnd");
  var UTF8ArrayToString = /* @__PURE__ */ __name((heapOrArray, idx = 0, maxBytesToRead, ignoreNul) => {
    var endPtr = findStringEnd(heapOrArray, idx, maxBytesToRead, ignoreNul);
    if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
      return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
    }
    var str = "";
    while (idx < endPtr) {
      var u0 = heapOrArray[idx++];
      if (!(u0 & 128)) {
        str += String.fromCharCode(u0);
        continue;
      }
      var u1 = heapOrArray[idx++] & 63;
      if ((u0 & 224) == 192) {
        str += String.fromCharCode((u0 & 31) << 6 | u1);
        continue;
      }
      var u2 = heapOrArray[idx++] & 63;
      if ((u0 & 240) == 224) {
        u0 = (u0 & 15) << 12 | u1 << 6 | u2;
      } else {
        u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | heapOrArray[idx++] & 63;
      }
      if (u0 < 65536) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 65536;
        str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
      }
    }
    return str;
  }, "UTF8ArrayToString");
  var getDylinkMetadata = /* @__PURE__ */ __name((binary2) => {
    var offset = 0;
    var end = 0;
    function getU8() {
      return binary2[offset++];
    }
    __name(getU8, "getU8");
    function getLEB() {
      var ret = 0;
      var mul = 1;
      while (1) {
        var byte = binary2[offset++];
        ret += (byte & 127) * mul;
        mul *= 128;
        if (!(byte & 128)) break;
      }
      return ret;
    }
    __name(getLEB, "getLEB");
    function getString() {
      var len = getLEB();
      offset += len;
      return UTF8ArrayToString(binary2, offset - len, len);
    }
    __name(getString, "getString");
    function getStringList() {
      var count2 = getLEB();
      var rtn = [];
      while (count2--) rtn.push(getString());
      return rtn;
    }
    __name(getStringList, "getStringList");
    function failIf(condition, message) {
      if (condition) throw new Error(message);
    }
    __name(failIf, "failIf");
    if (binary2 instanceof WebAssembly.Module) {
      var dylinkSection = WebAssembly.Module.customSections(binary2, "dylink.0");
      failIf(dylinkSection.length === 0, "need dylink section");
      binary2 = new Uint8Array(dylinkSection[0]);
      end = binary2.length;
    } else {
      var int32View = new Uint32Array(new Uint8Array(binary2.subarray(0, 24)).buffer);
      var magicNumberFound = int32View[0] == 1836278016 || int32View[0] == 6386541;
      failIf(!magicNumberFound, "need to see wasm magic number");
      failIf(binary2[8] !== 0, "need the dylink section to be first");
      offset = 9;
      var section_size = getLEB();
      end = offset + section_size;
      var name2 = getString();
      failIf(name2 !== "dylink.0");
    }
    var customSection = {
      neededDynlibs: [],
      tlsExports: /* @__PURE__ */ new Set(),
      weakImports: /* @__PURE__ */ new Set(),
      runtimePaths: []
    };
    var WASM_DYLINK_MEM_INFO = 1;
    var WASM_DYLINK_NEEDED = 2;
    var WASM_DYLINK_EXPORT_INFO = 3;
    var WASM_DYLINK_IMPORT_INFO = 4;
    var WASM_DYLINK_RUNTIME_PATH = 5;
    var WASM_SYMBOL_TLS = 256;
    var WASM_SYMBOL_BINDING_MASK = 3;
    var WASM_SYMBOL_BINDING_WEAK = 1;
    while (offset < end) {
      var subsectionType = getU8();
      var subsectionSize = getLEB();
      if (subsectionType === WASM_DYLINK_MEM_INFO) {
        customSection.memorySize = getLEB();
        customSection.memoryAlign = getLEB();
        customSection.tableSize = getLEB();
        customSection.tableAlign = getLEB();
      } else if (subsectionType === WASM_DYLINK_NEEDED) {
        customSection.neededDynlibs = getStringList();
      } else if (subsectionType === WASM_DYLINK_EXPORT_INFO) {
        var count = getLEB();
        while (count--) {
          var symname = getString();
          var flags2 = getLEB();
          if (flags2 & WASM_SYMBOL_TLS) {
            customSection.tlsExports.add(symname);
          }
        }
      } else if (subsectionType === WASM_DYLINK_IMPORT_INFO) {
        var count = getLEB();
        while (count--) {
          var modname = getString();
          var symname = getString();
          var flags2 = getLEB();
          if ((flags2 & WASM_SYMBOL_BINDING_MASK) == WASM_SYMBOL_BINDING_WEAK) {
            customSection.weakImports.add(symname);
          }
        }
      } else if (subsectionType === WASM_DYLINK_RUNTIME_PATH) {
        customSection.runtimePaths = getStringList();
      } else {
        offset += subsectionSize;
      }
    }
    return customSection;
  }, "getDylinkMetadata");
  function getValue(ptr, type = "i8") {
    if (type.endsWith("*")) type = "*";
    switch (type) {
      case "i1":
        return HEAP8[ptr];
      case "i8":
        return HEAP8[ptr];
      case "i16":
        return LE_HEAP_LOAD_I16((ptr >> 1) * 2);
      case "i32":
        return LE_HEAP_LOAD_I32((ptr >> 2) * 4);
      case "i64":
        return LE_HEAP_LOAD_I64((ptr >> 3) * 8);
      case "float":
        return LE_HEAP_LOAD_F32((ptr >> 2) * 4);
      case "double":
        return LE_HEAP_LOAD_F64((ptr >> 3) * 8);
      case "*":
        return LE_HEAP_LOAD_U32((ptr >> 2) * 4);
      default:
        abort(`invalid type for getValue: ${type}`);
    }
  }
  __name(getValue, "getValue");
  var newDSO = /* @__PURE__ */ __name((name2, handle2, syms) => {
    var dso = {
      refcount: Infinity,
      name: name2,
      exports: syms,
      global: true
    };
    LDSO.loadedLibsByName[name2] = dso;
    if (handle2 != void 0) {
      LDSO.loadedLibsByHandle[handle2] = dso;
    }
    return dso;
  }, "newDSO");
  var LDSO = {
    loadedLibsByName: {},
    loadedLibsByHandle: {},
    init() {
      newDSO("__main__", 0, wasmImports);
    }
  };
  var ___heap_base = 82240;
  var alignMemory = /* @__PURE__ */ __name((size, alignment) => Math.ceil(size / alignment) * alignment, "alignMemory");
  var getMemory = /* @__PURE__ */ __name((size) => {
    if (runtimeInitialized) {
      return _calloc(size, 1);
    }
    var ret = ___heap_base;
    var end = ret + alignMemory(size, 16);
    ___heap_base = end;
    GOT["__heap_base"].value = end;
    return ret;
  }, "getMemory");
  var isInternalSym = /* @__PURE__ */ __name((symName) => ["__cpp_exception", "__c_longjmp", "__wasm_apply_data_relocs", "__dso_handle", "__tls_size", "__tls_align", "__set_stack_limits", "_emscripten_tls_init", "__wasm_init_tls", "__wasm_call_ctors", "__start_em_asm", "__stop_em_asm", "__start_em_js", "__stop_em_js"].includes(symName) || symName.startsWith("__em_js__"), "isInternalSym");
  var uleb128EncodeWithLen = /* @__PURE__ */ __name((arr) => {
    const n = arr.length;
    return [n % 128 | 128, n >> 7, ...arr];
  }, "uleb128EncodeWithLen");
  var wasmTypeCodes = {
    "i": 127,
    // i32
    "p": 127,
    // i32
    "j": 126,
    // i64
    "f": 125,
    // f32
    "d": 124,
    // f64
    "e": 111
  };
  var generateTypePack = /* @__PURE__ */ __name((types) => uleb128EncodeWithLen(Array.from(types, (type) => {
    var code = wasmTypeCodes[type];
    return code;
  })), "generateTypePack");
  var convertJsFunctionToWasm = /* @__PURE__ */ __name((func2, sig) => {
    var bytes = Uint8Array.of(
      0,
      97,
      115,
      109,
      // magic ("\0asm")
      1,
      0,
      0,
      0,
      // version: 1
      1,
      ...uleb128EncodeWithLen([
        1,
        // count: 1
        96,
        // param types
        ...generateTypePack(sig.slice(1)),
        // return types (for now only supporting [] if `void` and single [T] otherwise)
        ...generateTypePack(sig[0] === "v" ? "" : sig[0])
      ]),
      // The rest of the module is static
      2,
      7,
      // import section
      // (import "e" "f" (func 0 (type 0)))
      1,
      1,
      101,
      1,
      102,
      0,
      0,
      7,
      5,
      // export section
      // (export "f" (func 0 (type 0)))
      1,
      1,
      102,
      0,
      0
    );
    var module2 = new WebAssembly.Module(bytes);
    var instance2 = new WebAssembly.Instance(module2, {
      "e": {
        "f": func2
      }
    });
    var wrappedFunc = instance2.exports["f"];
    return wrappedFunc;
  }, "convertJsFunctionToWasm");
  var wasmTableMirror = [];
  var wasmTable = new WebAssembly.Table({
    "initial": 31,
    "element": "anyfunc"
  });
  var getWasmTableEntry = /* @__PURE__ */ __name((funcPtr) => {
    var func2 = wasmTableMirror[funcPtr];
    if (!func2) {
      wasmTableMirror[funcPtr] = func2 = wasmTable.get(funcPtr);
    }
    return func2;
  }, "getWasmTableEntry");
  var updateTableMap = /* @__PURE__ */ __name((offset, count) => {
    if (functionsInTableMap) {
      for (var i2 = offset; i2 < offset + count; i2++) {
        var item = getWasmTableEntry(i2);
        if (item) {
          functionsInTableMap.set(item, i2);
        }
      }
    }
  }, "updateTableMap");
  var functionsInTableMap;
  var getFunctionAddress = /* @__PURE__ */ __name((func2) => {
    if (!functionsInTableMap) {
      functionsInTableMap = /* @__PURE__ */ new WeakMap();
      updateTableMap(0, wasmTable.length);
    }
    return functionsInTableMap.get(func2) || 0;
  }, "getFunctionAddress");
  var freeTableIndexes = [];
  var getEmptyTableSlot = /* @__PURE__ */ __name(() => {
    if (freeTableIndexes.length) {
      return freeTableIndexes.pop();
    }
    return wasmTable["grow"](1);
  }, "getEmptyTableSlot");
  var setWasmTableEntry = /* @__PURE__ */ __name((idx, func2) => {
    wasmTable.set(idx, func2);
    wasmTableMirror[idx] = wasmTable.get(idx);
  }, "setWasmTableEntry");
  var addFunction = /* @__PURE__ */ __name((func2, sig) => {
    var rtn = getFunctionAddress(func2);
    if (rtn) {
      return rtn;
    }
    var ret = getEmptyTableSlot();
    try {
      setWasmTableEntry(ret, func2);
    } catch (err2) {
      if (!(err2 instanceof TypeError)) {
        throw err2;
      }
      var wrapped = convertJsFunctionToWasm(func2, sig);
      setWasmTableEntry(ret, wrapped);
    }
    functionsInTableMap.set(func2, ret);
    return ret;
  }, "addFunction");
  var updateGOT = /* @__PURE__ */ __name((exports, replace) => {
    for (var symName in exports) {
      if (isInternalSym(symName)) {
        continue;
      }
      var value = exports[symName];
      GOT[symName] ||= new WebAssembly.Global({
        "value": "i32",
        "mutable": true
      });
      if (replace || GOT[symName].value == 0) {
        if (typeof value == "function") {
          GOT[symName].value = addFunction(value);
        } else if (typeof value == "number") {
          GOT[symName].value = value;
        } else {
          err(`unhandled export type for '${symName}': ${typeof value}`);
        }
      }
    }
  }, "updateGOT");
  var relocateExports = /* @__PURE__ */ __name((exports, memoryBase2, replace) => {
    var relocated = {};
    for (var e in exports) {
      var value = exports[e];
      if (typeof value == "object") {
        value = value.value;
      }
      if (typeof value == "number") {
        value += memoryBase2;
      }
      relocated[e] = value;
    }
    updateGOT(relocated, replace);
    return relocated;
  }, "relocateExports");
  var isSymbolDefined = /* @__PURE__ */ __name((symName) => {
    var existing = wasmImports[symName];
    if (!existing || existing.stub) {
      return false;
    }
    return true;
  }, "isSymbolDefined");
  var dynCall = /* @__PURE__ */ __name((sig, ptr, args2 = [], promising = false) => {
    var func2 = getWasmTableEntry(ptr);
    var rtn = func2(...args2);
    function convert(rtn2) {
      return rtn2;
    }
    __name(convert, "convert");
    return convert(rtn);
  }, "dynCall");
  var stackSave = /* @__PURE__ */ __name(() => _emscripten_stack_get_current(), "stackSave");
  var stackRestore = /* @__PURE__ */ __name((val) => __emscripten_stack_restore(val), "stackRestore");
  var createInvokeFunction = /* @__PURE__ */ __name((sig) => (ptr, ...args2) => {
    var sp = stackSave();
    try {
      return dynCall(sig, ptr, args2);
    } catch (e) {
      stackRestore(sp);
      if (e !== e + 0) throw e;
      _setThrew(1, 0);
      if (sig[0] == "j") return 0n;
    }
  }, "createInvokeFunction");
  var resolveGlobalSymbol = /* @__PURE__ */ __name((symName, direct = false) => {
    var sym;
    if (isSymbolDefined(symName)) {
      sym = wasmImports[symName];
    } else if (symName.startsWith("invoke_")) {
      sym = wasmImports[symName] = createInvokeFunction(symName.split("_")[1]);
    }
    return {
      sym,
      name: symName
    };
  }, "resolveGlobalSymbol");
  var onPostCtors = [];
  var addOnPostCtor = /* @__PURE__ */ __name((cb) => onPostCtors.push(cb), "addOnPostCtor");
  var UTF8ToString = /* @__PURE__ */ __name((ptr, maxBytesToRead, ignoreNul) => ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead, ignoreNul) : "", "UTF8ToString");
  var loadWebAssemblyModule = /* @__PURE__ */ __name((binary, flags, libName, localScope, handle) => {
    var metadata = getDylinkMetadata(binary);
    function loadModule() {
      var memAlign = Math.pow(2, metadata.memoryAlign);
      var memoryBase = metadata.memorySize ? alignMemory(getMemory(metadata.memorySize + memAlign), memAlign) : 0;
      var tableBase = metadata.tableSize ? wasmTable.length : 0;
      if (handle) {
        HEAP8[handle + 8] = 1;
        LE_HEAP_STORE_U32((handle + 12 >> 2) * 4, memoryBase);
        LE_HEAP_STORE_I32((handle + 16 >> 2) * 4, metadata.memorySize);
        LE_HEAP_STORE_U32((handle + 20 >> 2) * 4, tableBase);
        LE_HEAP_STORE_I32((handle + 24 >> 2) * 4, metadata.tableSize);
      }
      if (metadata.tableSize) {
        wasmTable.grow(metadata.tableSize);
      }
      var moduleExports;
      function resolveSymbol(sym) {
        var resolved = resolveGlobalSymbol(sym).sym;
        if (!resolved && localScope) {
          resolved = localScope[sym];
        }
        if (!resolved) {
          resolved = moduleExports[sym];
        }
        return resolved;
      }
      __name(resolveSymbol, "resolveSymbol");
      var proxyHandler = {
        get(stubs, prop) {
          switch (prop) {
            case "__memory_base":
              return memoryBase;
            case "__table_base":
              return tableBase;
          }
          if (prop in wasmImports && !wasmImports[prop].stub) {
            var res = wasmImports[prop];
            return res;
          }
          if (!(prop in stubs)) {
            var resolved;
            stubs[prop] = (...args2) => {
              resolved ||= resolveSymbol(prop);
              return resolved(...args2);
            };
          }
          return stubs[prop];
        }
      };
      var proxy = new Proxy({}, proxyHandler);
      currentModuleWeakSymbols = metadata.weakImports;
      var info = {
        "GOT.mem": new Proxy({}, GOTHandler),
        "GOT.func": new Proxy({}, GOTHandler),
        "env": proxy,
        "wasi_snapshot_preview1": proxy
      };
      function postInstantiation(module, instance) {
        updateTableMap(tableBase, metadata.tableSize);
        moduleExports = relocateExports(instance.exports, memoryBase);
        if (!flags.allowUndefined) {
          reportUndefinedSymbols();
        }
        function addEmAsm(addr, body) {
          var args = [];
          var arity = 0;
          for (; arity < 16; arity++) {
            if (body.indexOf("$" + arity) != -1) {
              args.push("$" + arity);
            } else {
              break;
            }
          }
          args = args.join(",");
          var func = `(${args}) => { ${body} };`;
          ASM_CONSTS[start] = eval(func);
        }
        __name(addEmAsm, "addEmAsm");
        if ("__start_em_asm" in moduleExports) {
          var start = moduleExports["__start_em_asm"];
          var stop = moduleExports["__stop_em_asm"];
          while (start < stop) {
            var jsString = UTF8ToString(start);
            addEmAsm(start, jsString);
            start = HEAPU8.indexOf(0, start) + 1;
          }
        }
        function addEmJs(name, cSig, body) {
          var jsArgs = [];
          cSig = cSig.slice(1, -1);
          if (cSig != "void") {
            cSig = cSig.split(",");
            for (var i in cSig) {
              var jsArg = cSig[i].split(" ").pop();
              jsArgs.push(jsArg.replace("*", ""));
            }
          }
          var func = `(${jsArgs}) => ${body};`;
          moduleExports[name] = eval(func);
        }
        __name(addEmJs, "addEmJs");
        for (var name in moduleExports) {
          if (name.startsWith("__em_js__")) {
            var start = moduleExports[name];
            var jsString = UTF8ToString(start);
            var parts = jsString.split("<::>");
            addEmJs(name.replace("__em_js__", ""), parts[0], parts[1]);
            delete moduleExports[name];
          }
        }
        var applyRelocs = moduleExports["__wasm_apply_data_relocs"];
        if (applyRelocs) {
          if (runtimeInitialized) {
            applyRelocs();
          } else {
            __RELOC_FUNCS__.push(applyRelocs);
          }
        }
        var init = moduleExports["__wasm_call_ctors"];
        if (init) {
          if (runtimeInitialized) {
            init();
          } else {
            addOnPostCtor(init);
          }
        }
        return moduleExports;
      }
      __name(postInstantiation, "postInstantiation");
      if (flags.loadAsync) {
        return (async () => {
          var instance2;
          if (binary instanceof WebAssembly.Module) {
            instance2 = new WebAssembly.Instance(binary, info);
          } else {
            ({ module: binary, instance: instance2 } = await WebAssembly.instantiate(binary, info));
          }
          return postInstantiation(binary, instance2);
        })();
      }
      var module = binary instanceof WebAssembly.Module ? binary : new WebAssembly.Module(binary);
      var instance = new WebAssembly.Instance(module, info);
      return postInstantiation(module, instance);
    }
    __name(loadModule, "loadModule");
    flags = {
      ...flags,
      rpath: {
        parentLibPath: libName,
        paths: metadata.runtimePaths
      }
    };
    if (flags.loadAsync) {
      return metadata.neededDynlibs.reduce((chain, dynNeeded) => chain.then(() => loadDynamicLibrary(dynNeeded, flags, localScope)), Promise.resolve()).then(loadModule);
    }
    metadata.neededDynlibs.forEach((needed) => loadDynamicLibrary(needed, flags, localScope));
    return loadModule();
  }, "loadWebAssemblyModule");
  var mergeLibSymbols = /* @__PURE__ */ __name((exports, libName2) => {
    for (var [sym, exp] of Object.entries(exports)) {
      const setImport = /* @__PURE__ */ __name((target) => {
        if (!isSymbolDefined(target)) {
          wasmImports[target] = exp;
        }
      }, "setImport");
      setImport(sym);
      const main_alias = "__main_argc_argv";
      if (sym == "main") {
        setImport(main_alias);
      }
      if (sym == main_alias) {
        setImport("main");
      }
    }
  }, "mergeLibSymbols");
  var asyncLoad = /* @__PURE__ */ __name(async (url) => {
    var arrayBuffer = await readAsync(url);
    return new Uint8Array(arrayBuffer);
  }, "asyncLoad");
  function loadDynamicLibrary(libName2, flags2 = {
    global: true,
    nodelete: true
  }, localScope2, handle2) {
    var dso = LDSO.loadedLibsByName[libName2];
    if (dso) {
      if (!flags2.global) {
        if (localScope2) {
          Object.assign(localScope2, dso.exports);
        }
      } else if (!dso.global) {
        dso.global = true;
        mergeLibSymbols(dso.exports, libName2);
      }
      if (flags2.nodelete && dso.refcount !== Infinity) {
        dso.refcount = Infinity;
      }
      dso.refcount++;
      if (handle2) {
        LDSO.loadedLibsByHandle[handle2] = dso;
      }
      return flags2.loadAsync ? Promise.resolve(true) : true;
    }
    dso = newDSO(libName2, handle2, "loading");
    dso.refcount = flags2.nodelete ? Infinity : 1;
    dso.global = flags2.global;
    function loadLibData() {
      if (handle2) {
        var data = LE_HEAP_LOAD_U32((handle2 + 28 >> 2) * 4);
        var dataSize = LE_HEAP_LOAD_U32((handle2 + 32 >> 2) * 4);
        if (data && dataSize) {
          var libData = HEAP8.slice(data, data + dataSize);
          return flags2.loadAsync ? Promise.resolve(libData) : libData;
        }
      }
      var libFile = locateFile(libName2);
      if (flags2.loadAsync) {
        return asyncLoad(libFile);
      }
      if (!readBinary) {
        throw new Error(`${libFile}: file not found, and synchronous loading of external files is not available`);
      }
      return readBinary(libFile);
    }
    __name(loadLibData, "loadLibData");
    function getExports() {
      if (flags2.loadAsync) {
        return loadLibData().then((libData) => loadWebAssemblyModule(libData, flags2, libName2, localScope2, handle2));
      }
      return loadWebAssemblyModule(loadLibData(), flags2, libName2, localScope2, handle2);
    }
    __name(getExports, "getExports");
    function moduleLoaded(exports) {
      if (dso.global) {
        mergeLibSymbols(exports, libName2);
      } else if (localScope2) {
        Object.assign(localScope2, exports);
      }
      dso.exports = exports;
    }
    __name(moduleLoaded, "moduleLoaded");
    if (flags2.loadAsync) {
      return getExports().then((exports) => {
        moduleLoaded(exports);
        return true;
      });
    }
    moduleLoaded(getExports());
    return true;
  }
  __name(loadDynamicLibrary, "loadDynamicLibrary");
  var reportUndefinedSymbols = /* @__PURE__ */ __name(() => {
    for (var [symName, entry] of Object.entries(GOT)) {
      if (entry.value == 0) {
        var value = resolveGlobalSymbol(symName, true).sym;
        if (!value && !entry.required) {
          continue;
        }
        if (typeof value == "function") {
          entry.value = addFunction(value, value.sig);
        } else if (typeof value == "number") {
          entry.value = value;
        } else {
          throw new Error(`bad export type for '${symName}': ${typeof value}`);
        }
      }
    }
  }, "reportUndefinedSymbols");
  var runDependencies = 0;
  var dependenciesFulfilled = null;
  var removeRunDependency = /* @__PURE__ */ __name((id) => {
    runDependencies--;
    Module["monitorRunDependencies"]?.(runDependencies);
    if (runDependencies == 0) {
      if (dependenciesFulfilled) {
        var callback = dependenciesFulfilled;
        dependenciesFulfilled = null;
        callback();
      }
    }
  }, "removeRunDependency");
  var addRunDependency = /* @__PURE__ */ __name((id) => {
    runDependencies++;
    Module["monitorRunDependencies"]?.(runDependencies);
  }, "addRunDependency");
  var loadDylibs = /* @__PURE__ */ __name(async () => {
    if (!dynamicLibraries.length) {
      reportUndefinedSymbols();
      return;
    }
    addRunDependency("loadDylibs");
    for (var lib of dynamicLibraries) {
      await loadDynamicLibrary(lib, {
        loadAsync: true,
        global: true,
        nodelete: true,
        allowUndefined: true
      });
    }
    reportUndefinedSymbols();
    removeRunDependency("loadDylibs");
  }, "loadDylibs");
  var noExitRuntime = true;
  function setValue(ptr, value, type = "i8") {
    if (type.endsWith("*")) type = "*";
    switch (type) {
      case "i1":
        HEAP8[ptr] = value;
        break;
      case "i8":
        HEAP8[ptr] = value;
        break;
      case "i16":
        LE_HEAP_STORE_I16((ptr >> 1) * 2, value);
        break;
      case "i32":
        LE_HEAP_STORE_I32((ptr >> 2) * 4, value);
        break;
      case "i64":
        LE_HEAP_STORE_I64((ptr >> 3) * 8, BigInt(value));
        break;
      case "float":
        LE_HEAP_STORE_F32((ptr >> 2) * 4, value);
        break;
      case "double":
        LE_HEAP_STORE_F64((ptr >> 3) * 8, value);
        break;
      case "*":
        LE_HEAP_STORE_U32((ptr >> 2) * 4, value);
        break;
      default:
        abort(`invalid type for setValue: ${type}`);
    }
  }
  __name(setValue, "setValue");
  var ___memory_base = new WebAssembly.Global({
    "value": "i32",
    "mutable": false
  }, 1024);
  var ___stack_high = 82240;
  var ___stack_low = 16704;
  var ___stack_pointer = new WebAssembly.Global({
    "value": "i32",
    "mutable": true
  }, 82240);
  var ___table_base = new WebAssembly.Global({
    "value": "i32",
    "mutable": false
  }, 1);
  var __abort_js = /* @__PURE__ */ __name(() => abort(""), "__abort_js");
  __abort_js.sig = "v";
  var getHeapMax = /* @__PURE__ */ __name(() => (
    // Stay one Wasm page short of 4GB: while e.g. Chrome is able to allocate
    // full 4GB Wasm memories, the size will wrap back to 0 bytes in Wasm side
    // for any code that deals with heap sizes, which would require special
    // casing all heap size related code to treat 0 specially.
    2147483648
  ), "getHeapMax");
  var growMemory = /* @__PURE__ */ __name((size) => {
    var oldHeapSize = wasmMemory.buffer.byteLength;
    var pages = (size - oldHeapSize + 65535) / 65536 | 0;
    try {
      wasmMemory.grow(pages);
      updateMemoryViews();
      return 1;
    } catch (e) {
    }
  }, "growMemory");
  var _emscripten_resize_heap = /* @__PURE__ */ __name((requestedSize) => {
    var oldSize = HEAPU8.length;
    requestedSize >>>= 0;
    var maxHeapSize = getHeapMax();
    if (requestedSize > maxHeapSize) {
      return false;
    }
    for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
      var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown);
      overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
      var newSize = Math.min(maxHeapSize, alignMemory(Math.max(requestedSize, overGrownHeapSize), 65536));
      var replacement = growMemory(newSize);
      if (replacement) {
        return true;
      }
    }
    return false;
  }, "_emscripten_resize_heap");
  _emscripten_resize_heap.sig = "ip";
  var _fd_close = /* @__PURE__ */ __name((fd) => 52, "_fd_close");
  _fd_close.sig = "ii";
  var INT53_MAX = 9007199254740992;
  var INT53_MIN = -9007199254740992;
  var bigintToI53Checked = /* @__PURE__ */ __name((num) => num < INT53_MIN || num > INT53_MAX ? NaN : Number(num), "bigintToI53Checked");
  function _fd_seek(fd, offset, whence, newOffset) {
    offset = bigintToI53Checked(offset);
    return 70;
  }
  __name(_fd_seek, "_fd_seek");
  _fd_seek.sig = "iijip";
  var printCharBuffers = [null, [], []];
  var printChar = /* @__PURE__ */ __name((stream, curr) => {
    var buffer = printCharBuffers[stream];
    if (curr === 0 || curr === 10) {
      (stream === 1 ? out : err)(UTF8ArrayToString(buffer));
      buffer.length = 0;
    } else {
      buffer.push(curr);
    }
  }, "printChar");
  var _fd_write = /* @__PURE__ */ __name((fd, iov, iovcnt, pnum) => {
    var num = 0;
    for (var i2 = 0; i2 < iovcnt; i2++) {
      var ptr = LE_HEAP_LOAD_U32((iov >> 2) * 4);
      var len = LE_HEAP_LOAD_U32((iov + 4 >> 2) * 4);
      iov += 8;
      for (var j = 0; j < len; j++) {
        printChar(fd, HEAPU8[ptr + j]);
      }
      num += len;
    }
    LE_HEAP_STORE_U32((pnum >> 2) * 4, num);
    return 0;
  }, "_fd_write");
  _fd_write.sig = "iippp";
  function _tree_sitter_log_callback(isLexMessage, messageAddress) {
    if (Module.currentLogCallback) {
      const message = UTF8ToString(messageAddress);
      Module.currentLogCallback(message, isLexMessage !== 0);
    }
  }
  __name(_tree_sitter_log_callback, "_tree_sitter_log_callback");
  function _tree_sitter_parse_callback(inputBufferAddress, index, row, column, lengthAddress) {
    const INPUT_BUFFER_SIZE = 10 * 1024;
    const string = Module.currentParseCallback(index, {
      row,
      column
    });
    if (typeof string === "string") {
      setValue(lengthAddress, string.length, "i32");
      stringToUTF16(string, inputBufferAddress, INPUT_BUFFER_SIZE);
    } else {
      setValue(lengthAddress, 0, "i32");
    }
  }
  __name(_tree_sitter_parse_callback, "_tree_sitter_parse_callback");
  function _tree_sitter_progress_callback(currentOffset, hasError) {
    if (Module.currentProgressCallback) {
      return Module.currentProgressCallback({
        currentOffset,
        hasError
      });
    }
    return false;
  }
  __name(_tree_sitter_progress_callback, "_tree_sitter_progress_callback");
  function _tree_sitter_query_progress_callback(currentOffset) {
    if (Module.currentQueryProgressCallback) {
      return Module.currentQueryProgressCallback({
        currentOffset
      });
    }
    return false;
  }
  __name(_tree_sitter_query_progress_callback, "_tree_sitter_query_progress_callback");
  var runtimeKeepaliveCounter = 0;
  var keepRuntimeAlive = /* @__PURE__ */ __name(() => noExitRuntime || runtimeKeepaliveCounter > 0, "keepRuntimeAlive");
  var _proc_exit = /* @__PURE__ */ __name((code) => {
    EXITSTATUS = code;
    if (!keepRuntimeAlive()) {
      Module["onExit"]?.(code);
      ABORT = true;
    }
    quit_(code, new ExitStatus(code));
  }, "_proc_exit");
  _proc_exit.sig = "vi";
  var exitJS = /* @__PURE__ */ __name((status, implicit) => {
    EXITSTATUS = status;
    _proc_exit(status);
  }, "exitJS");
  var handleException = /* @__PURE__ */ __name((e) => {
    if (e instanceof ExitStatus || e == "unwind") {
      return EXITSTATUS;
    }
    quit_(1, e);
  }, "handleException");
  var lengthBytesUTF8 = /* @__PURE__ */ __name((str) => {
    var len = 0;
    for (var i2 = 0; i2 < str.length; ++i2) {
      var c = str.charCodeAt(i2);
      if (c <= 127) {
        len++;
      } else if (c <= 2047) {
        len += 2;
      } else if (c >= 55296 && c <= 57343) {
        len += 4;
        ++i2;
      } else {
        len += 3;
      }
    }
    return len;
  }, "lengthBytesUTF8");
  var stringToUTF8Array = /* @__PURE__ */ __name((str, heap, outIdx, maxBytesToWrite) => {
    if (!(maxBytesToWrite > 0)) return 0;
    var startIdx = outIdx;
    var endIdx = outIdx + maxBytesToWrite - 1;
    for (var i2 = 0; i2 < str.length; ++i2) {
      var u = str.codePointAt(i2);
      if (u <= 127) {
        if (outIdx >= endIdx) break;
        heap[outIdx++] = u;
      } else if (u <= 2047) {
        if (outIdx + 1 >= endIdx) break;
        heap[outIdx++] = 192 | u >> 6;
        heap[outIdx++] = 128 | u & 63;
      } else if (u <= 65535) {
        if (outIdx + 2 >= endIdx) break;
        heap[outIdx++] = 224 | u >> 12;
        heap[outIdx++] = 128 | u >> 6 & 63;
        heap[outIdx++] = 128 | u & 63;
      } else {
        if (outIdx + 3 >= endIdx) break;
        heap[outIdx++] = 240 | u >> 18;
        heap[outIdx++] = 128 | u >> 12 & 63;
        heap[outIdx++] = 128 | u >> 6 & 63;
        heap[outIdx++] = 128 | u & 63;
        i2++;
      }
    }
    heap[outIdx] = 0;
    return outIdx - startIdx;
  }, "stringToUTF8Array");
  var stringToUTF8 = /* @__PURE__ */ __name((str, outPtr, maxBytesToWrite) => stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite), "stringToUTF8");
  var stackAlloc = /* @__PURE__ */ __name((sz) => __emscripten_stack_alloc(sz), "stackAlloc");
  var stringToUTF8OnStack = /* @__PURE__ */ __name((str) => {
    var size = lengthBytesUTF8(str) + 1;
    var ret = stackAlloc(size);
    stringToUTF8(str, ret, size);
    return ret;
  }, "stringToUTF8OnStack");
  var AsciiToString = /* @__PURE__ */ __name((ptr) => {
    var str = "";
    while (1) {
      var ch = HEAPU8[ptr++];
      if (!ch) return str;
      str += String.fromCharCode(ch);
    }
  }, "AsciiToString");
  var stringToUTF16 = /* @__PURE__ */ __name((str, outPtr, maxBytesToWrite) => {
    maxBytesToWrite ??= 2147483647;
    if (maxBytesToWrite < 2) return 0;
    maxBytesToWrite -= 2;
    var startPtr = outPtr;
    var numCharsToWrite = maxBytesToWrite < str.length * 2 ? maxBytesToWrite / 2 : str.length;
    for (var i2 = 0; i2 < numCharsToWrite; ++i2) {
      var codeUnit = str.charCodeAt(i2);
      LE_HEAP_STORE_I16((outPtr >> 1) * 2, codeUnit);
      outPtr += 2;
    }
    LE_HEAP_STORE_I16((outPtr >> 1) * 2, 0);
    return outPtr - startPtr;
  }, "stringToUTF16");
  LE_ATOMICS_NATIVE_BYTE_ORDER = new Int8Array(new Int16Array([1]).buffer)[0] === 1 ? [
    /* little endian */
    ((x) => x),
    ((x) => x),
    void 0,
    ((x) => x)
  ] : [
    /* big endian */
    ((x) => x),
    ((x) => ((x & 65280) << 8 | (x & 255) << 24) >> 16),
    void 0,
    ((x) => x >> 24 & 255 | x >> 8 & 65280 | (x & 65280) << 8 | (x & 255) << 24)
  ];
  function LE_HEAP_UPDATE() {
    HEAPU16.unsigned = ((x) => x & 65535);
    HEAPU32.unsigned = ((x) => x >>> 0);
  }
  __name(LE_HEAP_UPDATE, "LE_HEAP_UPDATE");
  {
    initMemory();
    if (Module["noExitRuntime"]) noExitRuntime = Module["noExitRuntime"];
    if (Module["print"]) out = Module["print"];
    if (Module["printErr"]) err = Module["printErr"];
    if (Module["dynamicLibraries"]) dynamicLibraries = Module["dynamicLibraries"];
    if (Module["wasmBinary"]) wasmBinary = Module["wasmBinary"];
    if (Module["arguments"]) arguments_ = Module["arguments"];
    if (Module["thisProgram"]) thisProgram = Module["thisProgram"];
    if (Module["preInit"]) {
      if (typeof Module["preInit"] == "function") Module["preInit"] = [Module["preInit"]];
      while (Module["preInit"].length > 0) {
        Module["preInit"].shift()();
      }
    }
  }
  Module["setValue"] = setValue;
  Module["getValue"] = getValue;
  Module["UTF8ToString"] = UTF8ToString;
  Module["stringToUTF8"] = stringToUTF8;
  Module["lengthBytesUTF8"] = lengthBytesUTF8;
  Module["AsciiToString"] = AsciiToString;
  Module["stringToUTF16"] = stringToUTF16;
  Module["loadWebAssemblyModule"] = loadWebAssemblyModule;
  Module["LE_HEAP_STORE_I64"] = LE_HEAP_STORE_I64;
  var ASM_CONSTS = {};
  var _malloc, _calloc, _realloc, _free, _ts_range_edit, _memcmp, _ts_language_symbol_count, _ts_language_state_count, _ts_language_abi_version, _ts_language_name, _ts_language_field_count, _ts_language_next_state, _ts_language_symbol_name, _ts_language_symbol_for_name, _strncmp, _ts_language_symbol_type, _ts_language_field_name_for_id, _ts_lookahead_iterator_new, _ts_lookahead_iterator_delete, _ts_lookahead_iterator_reset_state, _ts_lookahead_iterator_reset, _ts_lookahead_iterator_next, _ts_lookahead_iterator_current_symbol, _ts_point_edit, _ts_parser_delete, _ts_parser_reset, _ts_parser_set_language, _ts_parser_set_included_ranges, _ts_query_new, _ts_query_delete, _iswspace, _iswalnum, _ts_query_copy, _ts_query_pattern_count, _ts_query_capture_count, _ts_query_string_count, _ts_query_capture_name_for_id, _ts_query_capture_quantifier_for_id, _ts_query_string_value_for_id, _ts_query_predicates_for_pattern, _ts_query_start_byte_for_pattern, _ts_query_end_byte_for_pattern, _ts_query_is_pattern_rooted, _ts_query_is_pattern_non_local, _ts_query_is_pattern_guaranteed_at_step, _ts_query_disable_capture, _ts_query_disable_pattern, _ts_tree_copy, _ts_tree_delete, _ts_init, _ts_parser_new_wasm, _ts_parser_enable_logger_wasm, _ts_parser_parse_wasm, _ts_parser_included_ranges_wasm, _ts_language_type_is_named_wasm, _ts_language_type_is_visible_wasm, _ts_language_metadata_wasm, _ts_language_supertypes_wasm, _ts_language_subtypes_wasm, _ts_tree_root_node_wasm, _ts_tree_root_node_with_offset_wasm, _ts_tree_edit_wasm, _ts_tree_included_ranges_wasm, _ts_tree_get_changed_ranges_wasm, _ts_tree_cursor_new_wasm, _ts_tree_cursor_copy_wasm, _ts_tree_cursor_delete_wasm, _ts_tree_cursor_reset_wasm, _ts_tree_cursor_reset_to_wasm, _ts_tree_cursor_goto_first_child_wasm, _ts_tree_cursor_goto_last_child_wasm, _ts_tree_cursor_goto_first_child_for_index_wasm, _ts_tree_cursor_goto_first_child_for_position_wasm, _ts_tree_cursor_goto_next_sibling_wasm, _ts_tree_cursor_goto_previous_sibling_wasm, _ts_tree_cursor_goto_descendant_wasm, _ts_tree_cursor_goto_parent_wasm, _ts_tree_cursor_current_node_type_id_wasm, _ts_tree_cursor_current_node_state_id_wasm, _ts_tree_cursor_current_node_is_named_wasm, _ts_tree_cursor_current_node_is_missing_wasm, _ts_tree_cursor_current_node_id_wasm, _ts_tree_cursor_start_position_wasm, _ts_tree_cursor_end_position_wasm, _ts_tree_cursor_start_index_wasm, _ts_tree_cursor_end_index_wasm, _ts_tree_cursor_current_field_id_wasm, _ts_tree_cursor_current_depth_wasm, _ts_tree_cursor_current_descendant_index_wasm, _ts_tree_cursor_current_node_wasm, _ts_node_symbol_wasm, _ts_node_field_name_for_child_wasm, _ts_node_field_name_for_named_child_wasm, _ts_node_children_by_field_id_wasm, _ts_node_first_child_for_byte_wasm, _ts_node_first_named_child_for_byte_wasm, _ts_node_grammar_symbol_wasm, _ts_node_child_count_wasm, _ts_node_named_child_count_wasm, _ts_node_child_wasm, _ts_node_named_child_wasm, _ts_node_child_by_field_id_wasm, _ts_node_next_sibling_wasm, _ts_node_prev_sibling_wasm, _ts_node_next_named_sibling_wasm, _ts_node_prev_named_sibling_wasm, _ts_node_descendant_count_wasm, _ts_node_parent_wasm, _ts_node_child_with_descendant_wasm, _ts_node_descendant_for_index_wasm, _ts_node_named_descendant_for_index_wasm, _ts_node_descendant_for_position_wasm, _ts_node_named_descendant_for_position_wasm, _ts_node_start_point_wasm, _ts_node_end_point_wasm, _ts_node_start_index_wasm, _ts_node_end_index_wasm, _ts_node_to_string_wasm, _ts_node_children_wasm, _ts_node_named_children_wasm, _ts_node_descendants_of_type_wasm, _ts_node_is_named_wasm, _ts_node_has_changes_wasm, _ts_node_has_error_wasm, _ts_node_is_error_wasm, _ts_node_is_missing_wasm, _ts_node_is_extra_wasm, _ts_node_parse_state_wasm, _ts_node_next_parse_state_wasm, _ts_query_matches_wasm, _ts_query_captures_wasm, _memset, _memcpy, _memmove, _iswalpha, _iswblank, _iswdigit, _iswlower, _iswpunct, _iswupper, _iswxdigit, _memchr, _strlen, _strcmp, _strncat, _strncpy, _towlower, _towupper, _setThrew, __emscripten_stack_restore, __emscripten_stack_alloc, _emscripten_stack_get_current, ___wasm_apply_data_relocs;
  function assignWasmExports(wasmExports2) {
    Module["_malloc"] = _malloc = wasmExports2["malloc"];
    Module["_calloc"] = _calloc = wasmExports2["calloc"];
    Module["_realloc"] = _realloc = wasmExports2["realloc"];
    Module["_free"] = _free = wasmExports2["free"];
    Module["_ts_range_edit"] = _ts_range_edit = wasmExports2["ts_range_edit"];
    Module["_memcmp"] = _memcmp = wasmExports2["memcmp"];
    Module["_ts_language_symbol_count"] = _ts_language_symbol_count = wasmExports2["ts_language_symbol_count"];
    Module["_ts_language_state_count"] = _ts_language_state_count = wasmExports2["ts_language_state_count"];
    Module["_ts_language_abi_version"] = _ts_language_abi_version = wasmExports2["ts_language_abi_version"];
    Module["_ts_language_name"] = _ts_language_name = wasmExports2["ts_language_name"];
    Module["_ts_language_field_count"] = _ts_language_field_count = wasmExports2["ts_language_field_count"];
    Module["_ts_language_next_state"] = _ts_language_next_state = wasmExports2["ts_language_next_state"];
    Module["_ts_language_symbol_name"] = _ts_language_symbol_name = wasmExports2["ts_language_symbol_name"];
    Module["_ts_language_symbol_for_name"] = _ts_language_symbol_for_name = wasmExports2["ts_language_symbol_for_name"];
    Module["_strncmp"] = _strncmp = wasmExports2["strncmp"];
    Module["_ts_language_symbol_type"] = _ts_language_symbol_type = wasmExports2["ts_language_symbol_type"];
    Module["_ts_language_field_name_for_id"] = _ts_language_field_name_for_id = wasmExports2["ts_language_field_name_for_id"];
    Module["_ts_lookahead_iterator_new"] = _ts_lookahead_iterator_new = wasmExports2["ts_lookahead_iterator_new"];
    Module["_ts_lookahead_iterator_delete"] = _ts_lookahead_iterator_delete = wasmExports2["ts_lookahead_iterator_delete"];
    Module["_ts_lookahead_iterator_reset_state"] = _ts_lookahead_iterator_reset_state = wasmExports2["ts_lookahead_iterator_reset_state"];
    Module["_ts_lookahead_iterator_reset"] = _ts_lookahead_iterator_reset = wasmExports2["ts_lookahead_iterator_reset"];
    Module["_ts_lookahead_iterator_next"] = _ts_lookahead_iterator_next = wasmExports2["ts_lookahead_iterator_next"];
    Module["_ts_lookahead_iterator_current_symbol"] = _ts_lookahead_iterator_current_symbol = wasmExports2["ts_lookahead_iterator_current_symbol"];
    Module["_ts_point_edit"] = _ts_point_edit = wasmExports2["ts_point_edit"];
    Module["_ts_parser_delete"] = _ts_parser_delete = wasmExports2["ts_parser_delete"];
    Module["_ts_parser_reset"] = _ts_parser_reset = wasmExports2["ts_parser_reset"];
    Module["_ts_parser_set_language"] = _ts_parser_set_language = wasmExports2["ts_parser_set_language"];
    Module["_ts_parser_set_included_ranges"] = _ts_parser_set_included_ranges = wasmExports2["ts_parser_set_included_ranges"];
    Module["_ts_query_new"] = _ts_query_new = wasmExports2["ts_query_new"];
    Module["_ts_query_delete"] = _ts_query_delete = wasmExports2["ts_query_delete"];
    Module["_iswspace"] = _iswspace = wasmExports2["iswspace"];
    Module["_iswalnum"] = _iswalnum = wasmExports2["iswalnum"];
    Module["_ts_query_copy"] = _ts_query_copy = wasmExports2["ts_query_copy"];
    Module["_ts_query_pattern_count"] = _ts_query_pattern_count = wasmExports2["ts_query_pattern_count"];
    Module["_ts_query_capture_count"] = _ts_query_capture_count = wasmExports2["ts_query_capture_count"];
    Module["_ts_query_string_count"] = _ts_query_string_count = wasmExports2["ts_query_string_count"];
    Module["_ts_query_capture_name_for_id"] = _ts_query_capture_name_for_id = wasmExports2["ts_query_capture_name_for_id"];
    Module["_ts_query_capture_quantifier_for_id"] = _ts_query_capture_quantifier_for_id = wasmExports2["ts_query_capture_quantifier_for_id"];
    Module["_ts_query_string_value_for_id"] = _ts_query_string_value_for_id = wasmExports2["ts_query_string_value_for_id"];
    Module["_ts_query_predicates_for_pattern"] = _ts_query_predicates_for_pattern = wasmExports2["ts_query_predicates_for_pattern"];
    Module["_ts_query_start_byte_for_pattern"] = _ts_query_start_byte_for_pattern = wasmExports2["ts_query_start_byte_for_pattern"];
    Module["_ts_query_end_byte_for_pattern"] = _ts_query_end_byte_for_pattern = wasmExports2["ts_query_end_byte_for_pattern"];
    Module["_ts_query_is_pattern_rooted"] = _ts_query_is_pattern_rooted = wasmExports2["ts_query_is_pattern_rooted"];
    Module["_ts_query_is_pattern_non_local"] = _ts_query_is_pattern_non_local = wasmExports2["ts_query_is_pattern_non_local"];
    Module["_ts_query_is_pattern_guaranteed_at_step"] = _ts_query_is_pattern_guaranteed_at_step = wasmExports2["ts_query_is_pattern_guaranteed_at_step"];
    Module["_ts_query_disable_capture"] = _ts_query_disable_capture = wasmExports2["ts_query_disable_capture"];
    Module["_ts_query_disable_pattern"] = _ts_query_disable_pattern = wasmExports2["ts_query_disable_pattern"];
    Module["_ts_tree_copy"] = _ts_tree_copy = wasmExports2["ts_tree_copy"];
    Module["_ts_tree_delete"] = _ts_tree_delete = wasmExports2["ts_tree_delete"];
    Module["_ts_init"] = _ts_init = wasmExports2["ts_init"];
    Module["_ts_parser_new_wasm"] = _ts_parser_new_wasm = wasmExports2["ts_parser_new_wasm"];
    Module["_ts_parser_enable_logger_wasm"] = _ts_parser_enable_logger_wasm = wasmExports2["ts_parser_enable_logger_wasm"];
    Module["_ts_parser_parse_wasm"] = _ts_parser_parse_wasm = wasmExports2["ts_parser_parse_wasm"];
    Module["_ts_parser_included_ranges_wasm"] = _ts_parser_included_ranges_wasm = wasmExports2["ts_parser_included_ranges_wasm"];
    Module["_ts_language_type_is_named_wasm"] = _ts_language_type_is_named_wasm = wasmExports2["ts_language_type_is_named_wasm"];
    Module["_ts_language_type_is_visible_wasm"] = _ts_language_type_is_visible_wasm = wasmExports2["ts_language_type_is_visible_wasm"];
    Module["_ts_language_metadata_wasm"] = _ts_language_metadata_wasm = wasmExports2["ts_language_metadata_wasm"];
    Module["_ts_language_supertypes_wasm"] = _ts_language_supertypes_wasm = wasmExports2["ts_language_supertypes_wasm"];
    Module["_ts_language_subtypes_wasm"] = _ts_language_subtypes_wasm = wasmExports2["ts_language_subtypes_wasm"];
    Module["_ts_tree_root_node_wasm"] = _ts_tree_root_node_wasm = wasmExports2["ts_tree_root_node_wasm"];
    Module["_ts_tree_root_node_with_offset_wasm"] = _ts_tree_root_node_with_offset_wasm = wasmExports2["ts_tree_root_node_with_offset_wasm"];
    Module["_ts_tree_edit_wasm"] = _ts_tree_edit_wasm = wasmExports2["ts_tree_edit_wasm"];
    Module["_ts_tree_included_ranges_wasm"] = _ts_tree_included_ranges_wasm = wasmExports2["ts_tree_included_ranges_wasm"];
    Module["_ts_tree_get_changed_ranges_wasm"] = _ts_tree_get_changed_ranges_wasm = wasmExports2["ts_tree_get_changed_ranges_wasm"];
    Module["_ts_tree_cursor_new_wasm"] = _ts_tree_cursor_new_wasm = wasmExports2["ts_tree_cursor_new_wasm"];
    Module["_ts_tree_cursor_copy_wasm"] = _ts_tree_cursor_copy_wasm = wasmExports2["ts_tree_cursor_copy_wasm"];
    Module["_ts_tree_cursor_delete_wasm"] = _ts_tree_cursor_delete_wasm = wasmExports2["ts_tree_cursor_delete_wasm"];
    Module["_ts_tree_cursor_reset_wasm"] = _ts_tree_cursor_reset_wasm = wasmExports2["ts_tree_cursor_reset_wasm"];
    Module["_ts_tree_cursor_reset_to_wasm"] = _ts_tree_cursor_reset_to_wasm = wasmExports2["ts_tree_cursor_reset_to_wasm"];
    Module["_ts_tree_cursor_goto_first_child_wasm"] = _ts_tree_cursor_goto_first_child_wasm = wasmExports2["ts_tree_cursor_goto_first_child_wasm"];
    Module["_ts_tree_cursor_goto_last_child_wasm"] = _ts_tree_cursor_goto_last_child_wasm = wasmExports2["ts_tree_cursor_goto_last_child_wasm"];
    Module["_ts_tree_cursor_goto_first_child_for_index_wasm"] = _ts_tree_cursor_goto_first_child_for_index_wasm = wasmExports2["ts_tree_cursor_goto_first_child_for_index_wasm"];
    Module["_ts_tree_cursor_goto_first_child_for_position_wasm"] = _ts_tree_cursor_goto_first_child_for_position_wasm = wasmExports2["ts_tree_cursor_goto_first_child_for_position_wasm"];
    Module["_ts_tree_cursor_goto_next_sibling_wasm"] = _ts_tree_cursor_goto_next_sibling_wasm = wasmExports2["ts_tree_cursor_goto_next_sibling_wasm"];
    Module["_ts_tree_cursor_goto_previous_sibling_wasm"] = _ts_tree_cursor_goto_previous_sibling_wasm = wasmExports2["ts_tree_cursor_goto_previous_sibling_wasm"];
    Module["_ts_tree_cursor_goto_descendant_wasm"] = _ts_tree_cursor_goto_descendant_wasm = wasmExports2["ts_tree_cursor_goto_descendant_wasm"];
    Module["_ts_tree_cursor_goto_parent_wasm"] = _ts_tree_cursor_goto_parent_wasm = wasmExports2["ts_tree_cursor_goto_parent_wasm"];
    Module["_ts_tree_cursor_current_node_type_id_wasm"] = _ts_tree_cursor_current_node_type_id_wasm = wasmExports2["ts_tree_cursor_current_node_type_id_wasm"];
    Module["_ts_tree_cursor_current_node_state_id_wasm"] = _ts_tree_cursor_current_node_state_id_wasm = wasmExports2["ts_tree_cursor_current_node_state_id_wasm"];
    Module["_ts_tree_cursor_current_node_is_named_wasm"] = _ts_tree_cursor_current_node_is_named_wasm = wasmExports2["ts_tree_cursor_current_node_is_named_wasm"];
    Module["_ts_tree_cursor_current_node_is_missing_wasm"] = _ts_tree_cursor_current_node_is_missing_wasm = wasmExports2["ts_tree_cursor_current_node_is_missing_wasm"];
    Module["_ts_tree_cursor_current_node_id_wasm"] = _ts_tree_cursor_current_node_id_wasm = wasmExports2["ts_tree_cursor_current_node_id_wasm"];
    Module["_ts_tree_cursor_start_position_wasm"] = _ts_tree_cursor_start_position_wasm = wasmExports2["ts_tree_cursor_start_position_wasm"];
    Module["_ts_tree_cursor_end_position_wasm"] = _ts_tree_cursor_end_position_wasm = wasmExports2["ts_tree_cursor_end_position_wasm"];
    Module["_ts_tree_cursor_start_index_wasm"] = _ts_tree_cursor_start_index_wasm = wasmExports2["ts_tree_cursor_start_index_wasm"];
    Module["_ts_tree_cursor_end_index_wasm"] = _ts_tree_cursor_end_index_wasm = wasmExports2["ts_tree_cursor_end_index_wasm"];
    Module["_ts_tree_cursor_current_field_id_wasm"] = _ts_tree_cursor_current_field_id_wasm = wasmExports2["ts_tree_cursor_current_field_id_wasm"];
    Module["_ts_tree_cursor_current_depth_wasm"] = _ts_tree_cursor_current_depth_wasm = wasmExports2["ts_tree_cursor_current_depth_wasm"];
    Module["_ts_tree_cursor_current_descendant_index_wasm"] = _ts_tree_cursor_current_descendant_index_wasm = wasmExports2["ts_tree_cursor_current_descendant_index_wasm"];
    Module["_ts_tree_cursor_current_node_wasm"] = _ts_tree_cursor_current_node_wasm = wasmExports2["ts_tree_cursor_current_node_wasm"];
    Module["_ts_node_symbol_wasm"] = _ts_node_symbol_wasm = wasmExports2["ts_node_symbol_wasm"];
    Module["_ts_node_field_name_for_child_wasm"] = _ts_node_field_name_for_child_wasm = wasmExports2["ts_node_field_name_for_child_wasm"];
    Module["_ts_node_field_name_for_named_child_wasm"] = _ts_node_field_name_for_named_child_wasm = wasmExports2["ts_node_field_name_for_named_child_wasm"];
    Module["_ts_node_children_by_field_id_wasm"] = _ts_node_children_by_field_id_wasm = wasmExports2["ts_node_children_by_field_id_wasm"];
    Module["_ts_node_first_child_for_byte_wasm"] = _ts_node_first_child_for_byte_wasm = wasmExports2["ts_node_first_child_for_byte_wasm"];
    Module["_ts_node_first_named_child_for_byte_wasm"] = _ts_node_first_named_child_for_byte_wasm = wasmExports2["ts_node_first_named_child_for_byte_wasm"];
    Module["_ts_node_grammar_symbol_wasm"] = _ts_node_grammar_symbol_wasm = wasmExports2["ts_node_grammar_symbol_wasm"];
    Module["_ts_node_child_count_wasm"] = _ts_node_child_count_wasm = wasmExports2["ts_node_child_count_wasm"];
    Module["_ts_node_named_child_count_wasm"] = _ts_node_named_child_count_wasm = wasmExports2["ts_node_named_child_count_wasm"];
    Module["_ts_node_child_wasm"] = _ts_node_child_wasm = wasmExports2["ts_node_child_wasm"];
    Module["_ts_node_named_child_wasm"] = _ts_node_named_child_wasm = wasmExports2["ts_node_named_child_wasm"];
    Module["_ts_node_child_by_field_id_wasm"] = _ts_node_child_by_field_id_wasm = wasmExports2["ts_node_child_by_field_id_wasm"];
    Module["_ts_node_next_sibling_wasm"] = _ts_node_next_sibling_wasm = wasmExports2["ts_node_next_sibling_wasm"];
    Module["_ts_node_prev_sibling_wasm"] = _ts_node_prev_sibling_wasm = wasmExports2["ts_node_prev_sibling_wasm"];
    Module["_ts_node_next_named_sibling_wasm"] = _ts_node_next_named_sibling_wasm = wasmExports2["ts_node_next_named_sibling_wasm"];
    Module["_ts_node_prev_named_sibling_wasm"] = _ts_node_prev_named_sibling_wasm = wasmExports2["ts_node_prev_named_sibling_wasm"];
    Module["_ts_node_descendant_count_wasm"] = _ts_node_descendant_count_wasm = wasmExports2["ts_node_descendant_count_wasm"];
    Module["_ts_node_parent_wasm"] = _ts_node_parent_wasm = wasmExports2["ts_node_parent_wasm"];
    Module["_ts_node_child_with_descendant_wasm"] = _ts_node_child_with_descendant_wasm = wasmExports2["ts_node_child_with_descendant_wasm"];
    Module["_ts_node_descendant_for_index_wasm"] = _ts_node_descendant_for_index_wasm = wasmExports2["ts_node_descendant_for_index_wasm"];
    Module["_ts_node_named_descendant_for_index_wasm"] = _ts_node_named_descendant_for_index_wasm = wasmExports2["ts_node_named_descendant_for_index_wasm"];
    Module["_ts_node_descendant_for_position_wasm"] = _ts_node_descendant_for_position_wasm = wasmExports2["ts_node_descendant_for_position_wasm"];
    Module["_ts_node_named_descendant_for_position_wasm"] = _ts_node_named_descendant_for_position_wasm = wasmExports2["ts_node_named_descendant_for_position_wasm"];
    Module["_ts_node_start_point_wasm"] = _ts_node_start_point_wasm = wasmExports2["ts_node_start_point_wasm"];
    Module["_ts_node_end_point_wasm"] = _ts_node_end_point_wasm = wasmExports2["ts_node_end_point_wasm"];
    Module["_ts_node_start_index_wasm"] = _ts_node_start_index_wasm = wasmExports2["ts_node_start_index_wasm"];
    Module["_ts_node_end_index_wasm"] = _ts_node_end_index_wasm = wasmExports2["ts_node_end_index_wasm"];
    Module["_ts_node_to_string_wasm"] = _ts_node_to_string_wasm = wasmExports2["ts_node_to_string_wasm"];
    Module["_ts_node_children_wasm"] = _ts_node_children_wasm = wasmExports2["ts_node_children_wasm"];
    Module["_ts_node_named_children_wasm"] = _ts_node_named_children_wasm = wasmExports2["ts_node_named_children_wasm"];
    Module["_ts_node_descendants_of_type_wasm"] = _ts_node_descendants_of_type_wasm = wasmExports2["ts_node_descendants_of_type_wasm"];
    Module["_ts_node_is_named_wasm"] = _ts_node_is_named_wasm = wasmExports2["ts_node_is_named_wasm"];
    Module["_ts_node_has_changes_wasm"] = _ts_node_has_changes_wasm = wasmExports2["ts_node_has_changes_wasm"];
    Module["_ts_node_has_error_wasm"] = _ts_node_has_error_wasm = wasmExports2["ts_node_has_error_wasm"];
    Module["_ts_node_is_error_wasm"] = _ts_node_is_error_wasm = wasmExports2["ts_node_is_error_wasm"];
    Module["_ts_node_is_missing_wasm"] = _ts_node_is_missing_wasm = wasmExports2["ts_node_is_missing_wasm"];
    Module["_ts_node_is_extra_wasm"] = _ts_node_is_extra_wasm = wasmExports2["ts_node_is_extra_wasm"];
    Module["_ts_node_parse_state_wasm"] = _ts_node_parse_state_wasm = wasmExports2["ts_node_parse_state_wasm"];
    Module["_ts_node_next_parse_state_wasm"] = _ts_node_next_parse_state_wasm = wasmExports2["ts_node_next_parse_state_wasm"];
    Module["_ts_query_matches_wasm"] = _ts_query_matches_wasm = wasmExports2["ts_query_matches_wasm"];
    Module["_ts_query_captures_wasm"] = _ts_query_captures_wasm = wasmExports2["ts_query_captures_wasm"];
    Module["_memset"] = _memset = wasmExports2["memset"];
    Module["_memcpy"] = _memcpy = wasmExports2["memcpy"];
    Module["_memmove"] = _memmove = wasmExports2["memmove"];
    Module["_iswalpha"] = _iswalpha = wasmExports2["iswalpha"];
    Module["_iswblank"] = _iswblank = wasmExports2["iswblank"];
    Module["_iswdigit"] = _iswdigit = wasmExports2["iswdigit"];
    Module["_iswlower"] = _iswlower = wasmExports2["iswlower"];
    Module["_iswpunct"] = _iswpunct = wasmExports2["iswpunct"];
    Module["_iswupper"] = _iswupper = wasmExports2["iswupper"];
    Module["_iswxdigit"] = _iswxdigit = wasmExports2["iswxdigit"];
    Module["_memchr"] = _memchr = wasmExports2["memchr"];
    Module["_strlen"] = _strlen = wasmExports2["strlen"];
    Module["_strcmp"] = _strcmp = wasmExports2["strcmp"];
    Module["_strncat"] = _strncat = wasmExports2["strncat"];
    Module["_strncpy"] = _strncpy = wasmExports2["strncpy"];
    Module["_towlower"] = _towlower = wasmExports2["towlower"];
    Module["_towupper"] = _towupper = wasmExports2["towupper"];
    _setThrew = wasmExports2["setThrew"];
    __emscripten_stack_restore = wasmExports2["_emscripten_stack_restore"];
    __emscripten_stack_alloc = wasmExports2["_emscripten_stack_alloc"];
    _emscripten_stack_get_current = wasmExports2["emscripten_stack_get_current"];
    ___wasm_apply_data_relocs = wasmExports2["__wasm_apply_data_relocs"];
  }
  __name(assignWasmExports, "assignWasmExports");
  var wasmImports = {
    /** @export */
    __heap_base: ___heap_base,
    /** @export */
    __indirect_function_table: wasmTable,
    /** @export */
    __memory_base: ___memory_base,
    /** @export */
    __stack_high: ___stack_high,
    /** @export */
    __stack_low: ___stack_low,
    /** @export */
    __stack_pointer: ___stack_pointer,
    /** @export */
    __table_base: ___table_base,
    /** @export */
    _abort_js: __abort_js,
    /** @export */
    emscripten_resize_heap: _emscripten_resize_heap,
    /** @export */
    fd_close: _fd_close,
    /** @export */
    fd_seek: _fd_seek,
    /** @export */
    fd_write: _fd_write,
    /** @export */
    memory: wasmMemory,
    /** @export */
    tree_sitter_log_callback: _tree_sitter_log_callback,
    /** @export */
    tree_sitter_parse_callback: _tree_sitter_parse_callback,
    /** @export */
    tree_sitter_progress_callback: _tree_sitter_progress_callback,
    /** @export */
    tree_sitter_query_progress_callback: _tree_sitter_query_progress_callback
  };
  function callMain(args2 = []) {
    var entryFunction = resolveGlobalSymbol("main").sym;
    if (!entryFunction) return;
    args2.unshift(thisProgram);
    var argc = args2.length;
    var argv = stackAlloc((argc + 1) * 4);
    var argv_ptr = argv;
    args2.forEach((arg) => {
      LE_HEAP_STORE_U32((argv_ptr >> 2) * 4, stringToUTF8OnStack(arg));
      argv_ptr += 4;
    });
    LE_HEAP_STORE_U32((argv_ptr >> 2) * 4, 0);
    try {
      var ret = entryFunction(argc, argv);
      exitJS(
        ret,
        /* implicit = */
        true
      );
      return ret;
    } catch (e) {
      return handleException(e);
    }
  }
  __name(callMain, "callMain");
  function run(args2 = arguments_) {
    if (runDependencies > 0) {
      dependenciesFulfilled = run;
      return;
    }
    preRun();
    if (runDependencies > 0) {
      dependenciesFulfilled = run;
      return;
    }
    function doRun() {
      Module["calledRun"] = true;
      if (ABORT) return;
      initRuntime();
      preMain();
      readyPromiseResolve?.(Module);
      Module["onRuntimeInitialized"]?.();
      var noInitialRun = Module["noInitialRun"] || false;
      if (!noInitialRun) callMain(args2);
      postRun();
    }
    __name(doRun, "doRun");
    if (Module["setStatus"]) {
      Module["setStatus"]("Running...");
      setTimeout(() => {
        setTimeout(() => Module["setStatus"](""), 1);
        doRun();
      }, 1);
    } else {
      doRun();
    }
  }
  __name(run, "run");
  var wasmExports;
  wasmExports = await createWasm();
  run();
  if (runtimeInitialized) {
    moduleRtn = Module;
  } else {
    moduleRtn = new Promise((resolve, reject) => {
      readyPromiseResolve = resolve;
      readyPromiseReject = reject;
    });
  }
  return moduleRtn;
}
__name(Module2, "Module");
var web_tree_sitter_default = Module2;
var Module3 = null;
async function initializeBinding(moduleOptions) {
  return Module3 ??= await web_tree_sitter_default(moduleOptions);
}
__name(initializeBinding, "initializeBinding");
function checkModule() {
  return !!Module3;
}
__name(checkModule, "checkModule");
var TRANSFER_BUFFER;
var LANGUAGE_VERSION;
var MIN_COMPATIBLE_VERSION;
var finalizer4 = newFinalizer((addresses) => {
  C._ts_parser_delete(addresses[0]);
  C._free(addresses[1]);
});
var Parser = class {
  static {
    __name(this, "Parser");
  }
  /** @internal */
  [0] = 0;
  // Internal handle for Wasm
  /** @internal */
  [1] = 0;
  // Internal handle for Wasm
  /** @internal */
  logCallback = null;
  /** The parser's current language. */
  language = null;
  /**
   * This must always be called before creating a Parser.
   *
   * You can optionally pass in options to configure the Wasm module, the most common
   * one being `locateFile` to help the module find the `.wasm` file.
   */
  static async init(moduleOptions) {
    setModule(await initializeBinding(moduleOptions));
    TRANSFER_BUFFER = C._ts_init();
    LANGUAGE_VERSION = C.getValue(TRANSFER_BUFFER, "i32");
    MIN_COMPATIBLE_VERSION = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
  }
  /**
   * Create a new parser.
   */
  constructor() {
    this.initialize();
    finalizer4?.register(this, [this[0], this[1]], this);
  }
  /** @internal */
  initialize() {
    if (!checkModule()) {
      throw new Error("cannot construct a Parser before calling `init()`");
    }
    C._ts_parser_new_wasm();
    this[0] = C.getValue(TRANSFER_BUFFER, "i32");
    this[1] = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
  }
  /** Delete the parser, freeing its resources. */
  delete() {
    finalizer4?.unregister(this);
    C._ts_parser_delete(this[0]);
    C._free(this[1]);
    this[0] = 0;
    this[1] = 0;
  }
  /**
   * Set the language that the parser should use for parsing.
   *
   * If the language was not successfully assigned, an error will be thrown.
   * This happens if the language was generated with an incompatible
   * version of the Tree-sitter CLI. Check the language's version using
   * {@link Language#version} and compare it to this library's
   * {@link LANGUAGE_VERSION} and {@link MIN_COMPATIBLE_VERSION} constants.
   */
  setLanguage(language) {
    let address;
    if (!language) {
      address = 0;
      this.language = null;
    } else if (language.constructor === Language) {
      address = language[0];
      const version = C._ts_language_abi_version(address);
      if (version < MIN_COMPATIBLE_VERSION || LANGUAGE_VERSION < version) {
        throw new Error(
          `Incompatible language version ${version}. Compatibility range ${MIN_COMPATIBLE_VERSION} through ${LANGUAGE_VERSION}.`
        );
      }
      this.language = language;
    } else {
      throw new Error("Argument must be a Language");
    }
    C._ts_parser_set_language(this[0], address);
    return this;
  }
  /**
   * Parse a slice of UTF8 text.
   *
   * @param {string | ParseCallback} callback - The UTF8-encoded text to parse or a callback function.
   *
   * @param {Tree | null} [oldTree] - A previous syntax tree parsed from the same document. If the text of the
   *   document has changed since `oldTree` was created, then you must edit `oldTree` to match
   *   the new text using {@link Tree#edit}.
   *
   * @param {ParseOptions} [options] - Options for parsing the text.
   *  This can be used to set the included ranges, or a progress callback.
   *
   * @returns {Tree | null} A {@link Tree} if parsing succeeded, or `null` if:
   *  - The parser has not yet had a language assigned with {@link Parser#setLanguage}.
   *  - The progress callback returned true.
   */
  parse(callback, oldTree, options) {
    if (typeof callback === "string") {
      C.currentParseCallback = (index) => callback.slice(index);
    } else if (typeof callback === "function") {
      C.currentParseCallback = callback;
    } else {
      throw new Error("Argument must be a string or a function");
    }
    if (options?.progressCallback) {
      C.currentProgressCallback = options.progressCallback;
    } else {
      C.currentProgressCallback = null;
    }
    if (this.logCallback) {
      C.currentLogCallback = this.logCallback;
      C._ts_parser_enable_logger_wasm(this[0], 1);
    } else {
      C.currentLogCallback = null;
      C._ts_parser_enable_logger_wasm(this[0], 0);
    }
    let rangeCount = 0;
    let rangeAddress = 0;
    if (options?.includedRanges) {
      rangeCount = options.includedRanges.length;
      rangeAddress = C._calloc(rangeCount, SIZE_OF_RANGE);
      let address = rangeAddress;
      for (let i2 = 0; i2 < rangeCount; i2++) {
        marshalRange(address, options.includedRanges[i2]);
        address += SIZE_OF_RANGE;
      }
    }
    const treeAddress = C._ts_parser_parse_wasm(
      this[0],
      this[1],
      oldTree ? oldTree[0] : 0,
      rangeAddress,
      rangeCount
    );
    if (!treeAddress) {
      C.currentParseCallback = null;
      C.currentLogCallback = null;
      C.currentProgressCallback = null;
      return null;
    }
    if (!this.language) {
      throw new Error("Parser must have a language to parse");
    }
    const result = new Tree(INTERNAL, treeAddress, this.language, C.currentParseCallback);
    C.currentParseCallback = null;
    C.currentLogCallback = null;
    C.currentProgressCallback = null;
    return result;
  }
  /**
   * Instruct the parser to start the next parse from the beginning.
   *
   * If the parser previously failed because of a callback, 
   * then by default, it will resume where it left off on the
   * next call to {@link Parser#parse} or other parsing functions.
   * If you don't want to resume, and instead intend to use this parser to
   * parse some other document, you must call `reset` first.
   */
  reset() {
    C._ts_parser_reset(this[0]);
  }
  /** Get the ranges of text that the parser will include when parsing. */
  getIncludedRanges() {
    C._ts_parser_included_ranges_wasm(this[0]);
    const count = C.getValue(TRANSFER_BUFFER, "i32");
    const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
    const result = new Array(count);
    if (count > 0) {
      let address = buffer;
      for (let i2 = 0; i2 < count; i2++) {
        result[i2] = unmarshalRange(address);
        address += SIZE_OF_RANGE;
      }
      C._free(buffer);
    }
    return result;
  }
  /** Set the logging callback that a parser should use during parsing. */
  setLogger(callback) {
    if (!callback) {
      this.logCallback = null;
    } else if (typeof callback !== "function") {
      throw new Error("Logger callback must be a function");
    } else {
      this.logCallback = callback;
    }
    return this;
  }
  /** Get the parser's current logger. */
  getLogger() {
    return this.logCallback;
  }
};
var PREDICATE_STEP_TYPE_CAPTURE = 1;
var PREDICATE_STEP_TYPE_STRING = 2;
var QUERY_WORD_REGEX = /[\w-]+/g;
var CaptureQuantifier = {
  Zero: 0,
  ZeroOrOne: 1,
  ZeroOrMore: 2,
  One: 3,
  OneOrMore: 4
};
var isCaptureStep = /* @__PURE__ */ __name((step) => step.type === "capture", "isCaptureStep");
var isStringStep = /* @__PURE__ */ __name((step) => step.type === "string", "isStringStep");
var QueryErrorKind = {
  Syntax: 1,
  NodeName: 2,
  FieldName: 3,
  CaptureName: 4,
  PatternStructure: 5
};
var QueryError = class _QueryError extends Error {
  constructor(kind, info2, index, length) {
    super(_QueryError.formatMessage(kind, info2));
    this.kind = kind;
    this.info = info2;
    this.index = index;
    this.length = length;
    this.name = "QueryError";
  }
  kind;
  info;
  index;
  length;
  static {
    __name(this, "QueryError");
  }
  /** Formats an error message based on the error kind and info */
  static formatMessage(kind, info2) {
    switch (kind) {
      case QueryErrorKind.NodeName:
        return `Bad node name '${info2.word}'`;
      case QueryErrorKind.FieldName:
        return `Bad field name '${info2.word}'`;
      case QueryErrorKind.CaptureName:
        return `Bad capture name @${info2.word}`;
      case QueryErrorKind.PatternStructure:
        return `Bad pattern structure at offset ${info2.suffix}`;
      case QueryErrorKind.Syntax:
        return `Bad syntax at offset ${info2.suffix}`;
    }
  }
};
function parseAnyPredicate(steps, index, operator, textPredicates) {
  if (steps.length !== 3) {
    throw new Error(
      `Wrong number of arguments to \`#${operator}\` predicate. Expected 2, got ${steps.length - 1}`
    );
  }
  if (!isCaptureStep(steps[1])) {
    throw new Error(
      `First argument of \`#${operator}\` predicate must be a capture. Got "${steps[1].value}"`
    );
  }
  const isPositive = operator === "eq?" || operator === "any-eq?";
  const matchAll = !operator.startsWith("any-");
  if (isCaptureStep(steps[2])) {
    const captureName1 = steps[1].name;
    const captureName2 = steps[2].name;
    textPredicates[index].push((captures) => {
      const nodes1 = [];
      const nodes2 = [];
      for (const c of captures) {
        if (c.name === captureName1) nodes1.push(c.node);
        if (c.name === captureName2) nodes2.push(c.node);
      }
      const compare = /* @__PURE__ */ __name((n1, n2, positive) => {
        return positive ? n1.text === n2.text : n1.text !== n2.text;
      }, "compare");
      return matchAll ? nodes1.every((n1) => nodes2.some((n2) => compare(n1, n2, isPositive))) : nodes1.some((n1) => nodes2.some((n2) => compare(n1, n2, isPositive)));
    });
  } else {
    const captureName = steps[1].name;
    const stringValue = steps[2].value;
    const matches = /* @__PURE__ */ __name((n) => n.text === stringValue, "matches");
    const doesNotMatch = /* @__PURE__ */ __name((n) => n.text !== stringValue, "doesNotMatch");
    textPredicates[index].push((captures) => {
      const nodes = [];
      for (const c of captures) {
        if (c.name === captureName) nodes.push(c.node);
      }
      const test = isPositive ? matches : doesNotMatch;
      return matchAll ? nodes.every(test) : nodes.some(test);
    });
  }
}
__name(parseAnyPredicate, "parseAnyPredicate");
function parseMatchPredicate(steps, index, operator, textPredicates) {
  if (steps.length !== 3) {
    throw new Error(
      `Wrong number of arguments to \`#${operator}\` predicate. Expected 2, got ${steps.length - 1}.`
    );
  }
  if (steps[1].type !== "capture") {
    throw new Error(
      `First argument of \`#${operator}\` predicate must be a capture. Got "${steps[1].value}".`
    );
  }
  if (steps[2].type !== "string") {
    throw new Error(
      `Second argument of \`#${operator}\` predicate must be a string. Got @${steps[2].name}.`
    );
  }
  const isPositive = operator === "match?" || operator === "any-match?";
  const matchAll = !operator.startsWith("any-");
  const captureName = steps[1].name;
  const regex = new RegExp(steps[2].value);
  textPredicates[index].push((captures) => {
    const nodes = [];
    for (const c of captures) {
      if (c.name === captureName) nodes.push(c.node.text);
    }
    const test = /* @__PURE__ */ __name((text, positive) => {
      return positive ? regex.test(text) : !regex.test(text);
    }, "test");
    if (nodes.length === 0) return !isPositive;
    return matchAll ? nodes.every((text) => test(text, isPositive)) : nodes.some((text) => test(text, isPositive));
  });
}
__name(parseMatchPredicate, "parseMatchPredicate");
function parseAnyOfPredicate(steps, index, operator, textPredicates) {
  if (steps.length < 2) {
    throw new Error(
      `Wrong number of arguments to \`#${operator}\` predicate. Expected at least 1. Got ${steps.length - 1}.`
    );
  }
  if (steps[1].type !== "capture") {
    throw new Error(
      `First argument of \`#${operator}\` predicate must be a capture. Got "${steps[1].value}".`
    );
  }
  const isPositive = operator === "any-of?";
  const captureName = steps[1].name;
  const stringSteps = steps.slice(2);
  if (!stringSteps.every(isStringStep)) {
    throw new Error(
      `Arguments to \`#${operator}\` predicate must be strings.".`
    );
  }
  const values = stringSteps.map((s) => s.value);
  textPredicates[index].push((captures) => {
    const nodes = [];
    for (const c of captures) {
      if (c.name === captureName) nodes.push(c.node.text);
    }
    if (nodes.length === 0) return !isPositive;
    return nodes.every((text) => values.includes(text)) === isPositive;
  });
}
__name(parseAnyOfPredicate, "parseAnyOfPredicate");
function parseIsPredicate(steps, index, operator, assertedProperties, refutedProperties) {
  if (steps.length < 2 || steps.length > 3) {
    throw new Error(
      `Wrong number of arguments to \`#${operator}\` predicate. Expected 1 or 2. Got ${steps.length - 1}.`
    );
  }
  if (!steps.every(isStringStep)) {
    throw new Error(
      `Arguments to \`#${operator}\` predicate must be strings.".`
    );
  }
  const properties = operator === "is?" ? assertedProperties : refutedProperties;
  if (!properties[index]) properties[index] = {};
  properties[index][steps[1].value] = steps[2]?.value ?? null;
}
__name(parseIsPredicate, "parseIsPredicate");
function parseSetDirective(steps, index, setProperties) {
  if (steps.length < 2 || steps.length > 3) {
    throw new Error(`Wrong number of arguments to \`#set!\` predicate. Expected 1 or 2. Got ${steps.length - 1}.`);
  }
  if (!steps.every(isStringStep)) {
    throw new Error(`Arguments to \`#set!\` predicate must be strings.".`);
  }
  if (!setProperties[index]) setProperties[index] = {};
  setProperties[index][steps[1].value] = steps[2]?.value ?? null;
}
__name(parseSetDirective, "parseSetDirective");
function parsePattern(index, stepType, stepValueId, captureNames, stringValues, steps, textPredicates, predicates, setProperties, assertedProperties, refutedProperties) {
  if (stepType === PREDICATE_STEP_TYPE_CAPTURE) {
    const name2 = captureNames[stepValueId];
    steps.push({ type: "capture", name: name2 });
  } else if (stepType === PREDICATE_STEP_TYPE_STRING) {
    steps.push({ type: "string", value: stringValues[stepValueId] });
  } else if (steps.length > 0) {
    if (steps[0].type !== "string") {
      throw new Error("Predicates must begin with a literal value");
    }
    const operator = steps[0].value;
    switch (operator) {
      case "any-not-eq?":
      case "not-eq?":
      case "any-eq?":
      case "eq?":
        parseAnyPredicate(steps, index, operator, textPredicates);
        break;
      case "any-not-match?":
      case "not-match?":
      case "any-match?":
      case "match?":
        parseMatchPredicate(steps, index, operator, textPredicates);
        break;
      case "not-any-of?":
      case "any-of?":
        parseAnyOfPredicate(steps, index, operator, textPredicates);
        break;
      case "is?":
      case "is-not?":
        parseIsPredicate(steps, index, operator, assertedProperties, refutedProperties);
        break;
      case "set!":
        parseSetDirective(steps, index, setProperties);
        break;
      default:
        predicates[index].push({ operator, operands: steps.slice(1) });
    }
    steps.length = 0;
  }
}
__name(parsePattern, "parsePattern");
var finalizer5 = newFinalizer((address) => {
  C._ts_query_delete(address);
});
var Query = class {
  static {
    __name(this, "Query");
  }
  /** @internal */
  [0] = 0;
  // Internal handle for Wasm
  /** @internal */
  exceededMatchLimit;
  /** @internal */
  textPredicates;
  /** The names of the captures used in the query. */
  captureNames;
  /** The quantifiers of the captures used in the query. */
  captureQuantifiers;
  /**
   * The other user-defined predicates associated with the given index.
   *
   * This includes predicates with operators other than:
   * - `match?`
   * - `eq?` and `not-eq?`
   * - `any-of?` and `not-any-of?`
   * - `is?` and `is-not?`
   * - `set!`
   */
  predicates;
  /** The properties for predicates with the operator `set!`. */
  setProperties;
  /** The properties for predicates with the operator `is?`. */
  assertedProperties;
  /** The properties for predicates with the operator `is-not?`. */
  refutedProperties;
  /** The maximum number of in-progress matches for this cursor. */
  matchLimit;
  /**
   * Create a new query from a string containing one or more S-expression
   * patterns.
   *
   * The query is associated with a particular language, and can only be run
   * on syntax nodes parsed with that language. References to Queries can be
   * shared between multiple threads.
   *
   * @link {@see https://tree-sitter.github.io/tree-sitter/using-parsers/queries}
   */
  constructor(language, source) {
    const sourceLength = C.lengthBytesUTF8(source);
    const sourceAddress = C._malloc(sourceLength + 1);
    C.stringToUTF8(source, sourceAddress, sourceLength + 1);
    const address = C._ts_query_new(
      language[0],
      sourceAddress,
      sourceLength,
      TRANSFER_BUFFER,
      TRANSFER_BUFFER + SIZE_OF_INT
    );
    if (!address) {
      const errorId = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
      const errorByte = C.getValue(TRANSFER_BUFFER, "i32");
      const errorIndex = C.UTF8ToString(sourceAddress, errorByte).length;
      const suffix = source.slice(errorIndex, errorIndex + 100).split("\n")[0];
      const word = suffix.match(QUERY_WORD_REGEX)?.[0] ?? "";
      C._free(sourceAddress);
      switch (errorId) {
        case QueryErrorKind.Syntax:
          throw new QueryError(QueryErrorKind.Syntax, { suffix: `${errorIndex}: '${suffix}'...` }, errorIndex, 0);
        case QueryErrorKind.NodeName:
          throw new QueryError(errorId, { word }, errorIndex, word.length);
        case QueryErrorKind.FieldName:
          throw new QueryError(errorId, { word }, errorIndex, word.length);
        case QueryErrorKind.CaptureName:
          throw new QueryError(errorId, { word }, errorIndex, word.length);
        case QueryErrorKind.PatternStructure:
          throw new QueryError(errorId, { suffix: `${errorIndex}: '${suffix}'...` }, errorIndex, 0);
      }
    }
    const stringCount = C._ts_query_string_count(address);
    const captureCount = C._ts_query_capture_count(address);
    const patternCount = C._ts_query_pattern_count(address);
    const captureNames = new Array(captureCount);
    const captureQuantifiers = new Array(patternCount);
    const stringValues = new Array(stringCount);
    for (let i2 = 0; i2 < captureCount; i2++) {
      const nameAddress = C._ts_query_capture_name_for_id(
        address,
        i2,
        TRANSFER_BUFFER
      );
      const nameLength = C.getValue(TRANSFER_BUFFER, "i32");
      captureNames[i2] = C.UTF8ToString(nameAddress, nameLength);
    }
    for (let i2 = 0; i2 < patternCount; i2++) {
      const captureQuantifiersArray = new Array(captureCount);
      for (let j = 0; j < captureCount; j++) {
        const quantifier = C._ts_query_capture_quantifier_for_id(address, i2, j);
        captureQuantifiersArray[j] = quantifier;
      }
      captureQuantifiers[i2] = captureQuantifiersArray;
    }
    for (let i2 = 0; i2 < stringCount; i2++) {
      const valueAddress = C._ts_query_string_value_for_id(
        address,
        i2,
        TRANSFER_BUFFER
      );
      const nameLength = C.getValue(TRANSFER_BUFFER, "i32");
      stringValues[i2] = C.UTF8ToString(valueAddress, nameLength);
    }
    const setProperties = new Array(patternCount);
    const assertedProperties = new Array(patternCount);
    const refutedProperties = new Array(patternCount);
    const predicates = new Array(patternCount);
    const textPredicates = new Array(patternCount);
    for (let i2 = 0; i2 < patternCount; i2++) {
      const predicatesAddress = C._ts_query_predicates_for_pattern(address, i2, TRANSFER_BUFFER);
      const stepCount = C.getValue(TRANSFER_BUFFER, "i32");
      predicates[i2] = [];
      textPredicates[i2] = [];
      const steps = new Array();
      let stepAddress = predicatesAddress;
      for (let j = 0; j < stepCount; j++) {
        const stepType = C.getValue(stepAddress, "i32");
        stepAddress += SIZE_OF_INT;
        const stepValueId = C.getValue(stepAddress, "i32");
        stepAddress += SIZE_OF_INT;
        parsePattern(
          i2,
          stepType,
          stepValueId,
          captureNames,
          stringValues,
          steps,
          textPredicates,
          predicates,
          setProperties,
          assertedProperties,
          refutedProperties
        );
      }
      Object.freeze(textPredicates[i2]);
      Object.freeze(predicates[i2]);
      Object.freeze(setProperties[i2]);
      Object.freeze(assertedProperties[i2]);
      Object.freeze(refutedProperties[i2]);
    }
    C._free(sourceAddress);
    this[0] = address;
    this.captureNames = captureNames;
    this.captureQuantifiers = captureQuantifiers;
    this.textPredicates = textPredicates;
    this.predicates = predicates;
    this.setProperties = setProperties;
    this.assertedProperties = assertedProperties;
    this.refutedProperties = refutedProperties;
    this.exceededMatchLimit = false;
    finalizer5?.register(this, address, this);
  }
  /** Delete the query, freeing its resources. */
  delete() {
    finalizer5?.unregister(this);
    C._ts_query_delete(this[0]);
    this[0] = 0;
  }
  /**
   * Iterate over all of the matches in the order that they were found.
   *
   * Each match contains the index of the pattern that matched, and a list of
   * captures. Because multiple patterns can match the same set of nodes,
   * one match may contain captures that appear *before* some of the
   * captures from a previous match.
   *
   * @param {Node} node - The node to execute the query on.
   *
   * @param {QueryOptions} options - Options for query execution.
   */
  matches(node, options = {}) {
    const startPosition = options.startPosition ?? ZERO_POINT;
    const endPosition = options.endPosition ?? ZERO_POINT;
    const startIndex = options.startIndex ?? 0;
    const endIndex = options.endIndex ?? 0;
    const startContainingPosition = options.startContainingPosition ?? ZERO_POINT;
    const endContainingPosition = options.endContainingPosition ?? ZERO_POINT;
    const startContainingIndex = options.startContainingIndex ?? 0;
    const endContainingIndex = options.endContainingIndex ?? 0;
    const matchLimit = options.matchLimit ?? 4294967295;
    const maxStartDepth = options.maxStartDepth ?? 4294967295;
    const progressCallback = options.progressCallback;
    if (typeof matchLimit !== "number") {
      throw new Error("Arguments must be numbers");
    }
    this.matchLimit = matchLimit;
    if (endIndex !== 0 && startIndex > endIndex) {
      throw new Error("`startIndex` cannot be greater than `endIndex`");
    }
    if (endPosition !== ZERO_POINT && (startPosition.row > endPosition.row || startPosition.row === endPosition.row && startPosition.column > endPosition.column)) {
      throw new Error("`startPosition` cannot be greater than `endPosition`");
    }
    if (endContainingIndex !== 0 && startContainingIndex > endContainingIndex) {
      throw new Error("`startContainingIndex` cannot be greater than `endContainingIndex`");
    }
    if (endContainingPosition !== ZERO_POINT && (startContainingPosition.row > endContainingPosition.row || startContainingPosition.row === endContainingPosition.row && startContainingPosition.column > endContainingPosition.column)) {
      throw new Error("`startContainingPosition` cannot be greater than `endContainingPosition`");
    }
    if (progressCallback) {
      C.currentQueryProgressCallback = progressCallback;
    }
    marshalNode(node);
    C._ts_query_matches_wasm(
      this[0],
      node.tree[0],
      startPosition.row,
      startPosition.column,
      endPosition.row,
      endPosition.column,
      startIndex,
      endIndex,
      startContainingPosition.row,
      startContainingPosition.column,
      endContainingPosition.row,
      endContainingPosition.column,
      startContainingIndex,
      endContainingIndex,
      matchLimit,
      maxStartDepth
    );
    const rawCount = C.getValue(TRANSFER_BUFFER, "i32");
    const startAddress = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
    const didExceedMatchLimit = C.getValue(TRANSFER_BUFFER + 2 * SIZE_OF_INT, "i32");
    const result = new Array(rawCount);
    this.exceededMatchLimit = Boolean(didExceedMatchLimit);
    let filteredCount = 0;
    let address = startAddress;
    for (let i2 = 0; i2 < rawCount; i2++) {
      const patternIndex = C.getValue(address, "i32");
      address += SIZE_OF_INT;
      const captureCount = C.getValue(address, "i32");
      address += SIZE_OF_INT;
      const captures = new Array(captureCount);
      address = unmarshalCaptures(this, node.tree, address, patternIndex, captures);
      if (this.textPredicates[patternIndex].every((p) => p(captures))) {
        result[filteredCount] = { patternIndex, captures };
        const setProperties = this.setProperties[patternIndex];
        result[filteredCount].setProperties = setProperties;
        const assertedProperties = this.assertedProperties[patternIndex];
        result[filteredCount].assertedProperties = assertedProperties;
        const refutedProperties = this.refutedProperties[patternIndex];
        result[filteredCount].refutedProperties = refutedProperties;
        filteredCount++;
      }
    }
    result.length = filteredCount;
    C._free(startAddress);
    C.currentQueryProgressCallback = null;
    return result;
  }
  /**
   * Iterate over all of the individual captures in the order that they
   * appear.
   *
   * This is useful if you don't care about which pattern matched, and just
   * want a single, ordered sequence of captures.
   *
   * @param {Node} node - The node to execute the query on.
   *
   * @param {QueryOptions} options - Options for query execution.
   */
  captures(node, options = {}) {
    const startPosition = options.startPosition ?? ZERO_POINT;
    const endPosition = options.endPosition ?? ZERO_POINT;
    const startIndex = options.startIndex ?? 0;
    const endIndex = options.endIndex ?? 0;
    const startContainingPosition = options.startContainingPosition ?? ZERO_POINT;
    const endContainingPosition = options.endContainingPosition ?? ZERO_POINT;
    const startContainingIndex = options.startContainingIndex ?? 0;
    const endContainingIndex = options.endContainingIndex ?? 0;
    const matchLimit = options.matchLimit ?? 4294967295;
    const maxStartDepth = options.maxStartDepth ?? 4294967295;
    const progressCallback = options.progressCallback;
    if (typeof matchLimit !== "number") {
      throw new Error("Arguments must be numbers");
    }
    this.matchLimit = matchLimit;
    if (endIndex !== 0 && startIndex > endIndex) {
      throw new Error("`startIndex` cannot be greater than `endIndex`");
    }
    if (endPosition !== ZERO_POINT && (startPosition.row > endPosition.row || startPosition.row === endPosition.row && startPosition.column > endPosition.column)) {
      throw new Error("`startPosition` cannot be greater than `endPosition`");
    }
    if (endContainingIndex !== 0 && startContainingIndex > endContainingIndex) {
      throw new Error("`startContainingIndex` cannot be greater than `endContainingIndex`");
    }
    if (endContainingPosition !== ZERO_POINT && (startContainingPosition.row > endContainingPosition.row || startContainingPosition.row === endContainingPosition.row && startContainingPosition.column > endContainingPosition.column)) {
      throw new Error("`startContainingPosition` cannot be greater than `endContainingPosition`");
    }
    if (progressCallback) {
      C.currentQueryProgressCallback = progressCallback;
    }
    marshalNode(node);
    C._ts_query_captures_wasm(
      this[0],
      node.tree[0],
      startPosition.row,
      startPosition.column,
      endPosition.row,
      endPosition.column,
      startIndex,
      endIndex,
      startContainingPosition.row,
      startContainingPosition.column,
      endContainingPosition.row,
      endContainingPosition.column,
      startContainingIndex,
      endContainingIndex,
      matchLimit,
      maxStartDepth
    );
    const count = C.getValue(TRANSFER_BUFFER, "i32");
    const startAddress = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
    const didExceedMatchLimit = C.getValue(TRANSFER_BUFFER + 2 * SIZE_OF_INT, "i32");
    const result = new Array();
    this.exceededMatchLimit = Boolean(didExceedMatchLimit);
    const captures = new Array();
    let address = startAddress;
    for (let i2 = 0; i2 < count; i2++) {
      const patternIndex = C.getValue(address, "i32");
      address += SIZE_OF_INT;
      const captureCount = C.getValue(address, "i32");
      address += SIZE_OF_INT;
      const captureIndex = C.getValue(address, "i32");
      address += SIZE_OF_INT;
      captures.length = captureCount;
      address = unmarshalCaptures(this, node.tree, address, patternIndex, captures);
      if (this.textPredicates[patternIndex].every((p) => p(captures))) {
        const capture = captures[captureIndex];
        const setProperties = this.setProperties[patternIndex];
        capture.setProperties = setProperties;
        const assertedProperties = this.assertedProperties[patternIndex];
        capture.assertedProperties = assertedProperties;
        const refutedProperties = this.refutedProperties[patternIndex];
        capture.refutedProperties = refutedProperties;
        result.push(capture);
      }
    }
    C._free(startAddress);
    C.currentQueryProgressCallback = null;
    return result;
  }
  /** Get the predicates for a given pattern. */
  predicatesForPattern(patternIndex) {
    return this.predicates[patternIndex];
  }
  /**
   * Disable a certain capture within a query.
   *
   * This prevents the capture from being returned in matches, and also
   * avoids any resource usage associated with recording the capture.
   */
  disableCapture(captureName) {
    const captureNameLength = C.lengthBytesUTF8(captureName);
    const captureNameAddress = C._malloc(captureNameLength + 1);
    C.stringToUTF8(captureName, captureNameAddress, captureNameLength + 1);
    C._ts_query_disable_capture(this[0], captureNameAddress, captureNameLength);
    C._free(captureNameAddress);
  }
  /**
   * Disable a certain pattern within a query.
   *
   * This prevents the pattern from matching, and also avoids any resource
   * usage associated with the pattern. This throws an error if the pattern
   * index is out of bounds.
   */
  disablePattern(patternIndex) {
    if (patternIndex >= this.predicates.length) {
      throw new Error(
        `Pattern index is ${patternIndex} but the pattern count is ${this.predicates.length}`
      );
    }
    C._ts_query_disable_pattern(this[0], patternIndex);
  }
  /**
   * Check if, on its last execution, this cursor exceeded its maximum number
   * of in-progress matches.
   */
  didExceedMatchLimit() {
    return this.exceededMatchLimit;
  }
  /** Get the byte offset where the given pattern starts in the query's source. */
  startIndexForPattern(patternIndex) {
    if (patternIndex >= this.predicates.length) {
      throw new Error(
        `Pattern index is ${patternIndex} but the pattern count is ${this.predicates.length}`
      );
    }
    return C._ts_query_start_byte_for_pattern(this[0], patternIndex);
  }
  /** Get the byte offset where the given pattern ends in the query's source. */
  endIndexForPattern(patternIndex) {
    if (patternIndex >= this.predicates.length) {
      throw new Error(
        `Pattern index is ${patternIndex} but the pattern count is ${this.predicates.length}`
      );
    }
    return C._ts_query_end_byte_for_pattern(this[0], patternIndex);
  }
  /** Get the number of patterns in the query. */
  patternCount() {
    return C._ts_query_pattern_count(this[0]);
  }
  /** Get the index for a given capture name. */
  captureIndexForName(captureName) {
    return this.captureNames.indexOf(captureName);
  }
  /** Check if a given pattern within a query has a single root node. */
  isPatternRooted(patternIndex) {
    return C._ts_query_is_pattern_rooted(this[0], patternIndex) === 1;
  }
  /** Check if a given pattern within a query has a single root node. */
  isPatternNonLocal(patternIndex) {
    return C._ts_query_is_pattern_non_local(this[0], patternIndex) === 1;
  }
  /**
   * Check if a given step in a query is 'definite'.
   *
   * A query step is 'definite' if its parent pattern will be guaranteed to
   * match successfully once it reaches the step.
   */
  isPatternGuaranteedAtStep(byteIndex) {
    return C._ts_query_is_pattern_guaranteed_at_step(this[0], byteIndex) === 1;
  }
};

// src/engine/verdict.ts
var BUILTINS = /* @__PURE__ */ new Set(["echo", "printf", "test", "[", "cd", "export", "read", "set", "unset", "shift", "exit", "return", "eval", "exec", "source", ".", "alias", "type", "ulimit", "umask", "wait", "trap", "true", "false", "pwd", "local", "declare", "typeset", "let", "getopts", "hash", "jobs", "fg", "bg", "command", "builtin", "times", "readonly", "break", "continue"]);
var PLATFORM_LABEL = { ubuntu: "Ubuntu (GNU)", macos: "macOS (BSD)", alpine: "Alpine (BusyBox)" };
function probeFor(db, tool, flag, platform, shape = "bare") {
  const esc = flag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const first = new RegExp(shape === "attached" ? `^(?:printf [^|]*\\| )?${tool} ${esc}[^ '"]` : `^(?:printf [^|]*\\| )?${tool} ${esc}(?=[ =]|$)`);
  const anywhere = new RegExp(`^(?:printf [^|]*\\| )?${tool} .*(?:^|\\s)${esc}(?=[\\s=]|$)`);
  const name2 = flag.replace(/^-+/, "");
  const emptyArg = new RegExp(`${esc} ''`);
  const attached = new RegExp(`${esc}[^ '"]`);
  const shapeOk = (cmd) => shape === "empty" ? emptyArg.test(cmd) : shape === "attached" ? attached.test(cmd) : !emptyArg.test(cmd);
  const pick = (re) => {
    const hits = Object.values(db.probes).filter((p) => re.test(p.command) && p.results[platform] && shapeOk(p.command)).map((p) => ({ id: p.id, command: p.command, code: p.results[platform].code, stderr1: p.results[platform].stderr1 }));
    return hits.find((x) => x.code !== null && x.code !== 0 && rejectedName(x.stderr1) === name2) ?? hits.find((x) => x.code !== null && x.code !== 0 && rejectedName(x.stderr1) === "") ?? hits.find((x) => x.code === 0) ?? hits[0];
  };
  return pick(first) ?? pick(anywhere);
}
var EXPRESSION_TOOLS = /* @__PURE__ */ new Set(["find", "test", "[", "expr"]);
function rejectedName(stderr1) {
  const m = /option(?: --|:)? ?'?-{0,2}([A-Za-z0-9][A-Za-z0-9-]*)|unrecognized: (-{1,2}[A-Za-z0-9_-]+)|Option (--?[A-Za-z0-9-]+) is not supported|unknown primary or operator: (-[A-Za-z0-9_-]+)|(-[A-Za-z0-9_-]+): unknown primary|unknown predicate .(-[A-Za-z0-9_-]+)/.exec(stderr1);
  return m ? (m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? m[6] ?? "").replace(/^-+/, "").replace(/=.*$/, "") : "";
}
function documentationIsComplete(t) {
  return t.sources.includes("help") || t.sources.includes("mdoc") || t.sources.includes("usage") || t.sources.includes("man");
}
function probeArgOf(command, tool, flag) {
  const tokens = command.match(/'[^']*'|"[^"]*"|\S+/g) ?? [];
  const unquote = (s) => /^'.*'$|^".*"$/s.test(s) ? s.slice(1, -1) : s;
  const from = tokens.indexOf(tool);
  for (let i2 = from < 0 ? 0 : from + 1; i2 < tokens.length; i2++) {
    const t = tokens[i2];
    if (t === flag) return tokens[i2 + 1] === void 0 ? void 0 : unquote(tokens[i2 + 1]);
    if (!flag.startsWith("--") && t.startsWith(flag) && t.length > flag.length) return unquote(t.slice(flag.length));
    if (flag.startsWith("--") && t.startsWith(flag + "=")) return unquote(t.slice(flag.length + 1));
  }
  return void 0;
}
var NUMBER = /^[-+]?\d+$/;
var TEMPLATE = /X{3,}/;
var NATURAL_DATE = /^(?:yesterday|tomorrow|today|now|noon|midnight|(?:next|last|this) [a-z]+|[+-]?\d+ (?:sec(?:ond)?|min(?:ute)?|hour|day|week|fortnight|month|year)s?(?: ago)?)$/i;
function sameArgClass(script, probeArg, tool) {
  if (!script || !script.isStatic || probeArg === void 0) return true;
  const s = script.value, q = probeArg;
  if (s === "" || q === "") return s === q;
  if (NUMBER.test(s) && NUMBER.test(q)) return Math.sign(Number(s)) === Math.sign(Number(q));
  if (tool === "mktemp" || TEMPLATE.test(s) || TEMPLATE.test(q)) return TEMPLATE.test(s) === TEMPLATE.test(q);
  if (NATURAL_DATE.test(q)) return NATURAL_DATE.test(s);
  return true;
}
function judge(db, tool, flag, platform, shape = "bare", arg) {
  const label2 = PLATFORM_LABEL[platform];
  if (BUILTINS.has(tool)) {
    return { platform, tool, flag, status: "builtin", headline: `${tool} is a shell builtin: what ${flag} does depends on the shell (macOS /bin/sh is bash 3.2 in POSIX mode, Ubuntu's is dash, Alpine's is BusyBox ash), not on the userland.`, evidence: [] };
  }
  const t = db.tools[tool]?.[platform];
  if (!t) return { platform, tool, flag, status: "unknown", headline: `${tool} was not recorded on ${label2}.`, evidence: [] };
  if (!t.present) return { platform, tool, flag, status: "missing-tool", headline: `${tool} does not exist on ${label2} (command -v ${tool} found nothing on the recorded system).`, evidence: [] };
  const info2 = t.flags[flag];
  const when = db.platforms[platform] ? ` (${db.platforms[platform].os || label2}, run on ${db.platforms[platform].recorded_at.slice(0, 10)})` : "";
  const argNote = info2?.arg === "required" ? ", takes a required argument here" : info2?.arg === "optional" ? ", argument optional here" : "";
  const probe = probeFor(db, tool, flag, platform, shape);
  const run2 = t.runs?.[flag];
  if (run2) {
    if (run2.result === "rejected") {
      return { platform, tool, flag, status: "rejected", headline: `${tool} ${flag} does not exist on ${label2}: the binary answered "${run2.stderr1}"${when}${info2 ? ". The documentation still mentions it" : ""}.`, evidence: info2?.evidence ?? [], run: run2, ...probe ? { probe } : {} };
    }
    const how = run2.code === 0 ? "exit 0" : run2.stderr1 ? `it complained about something else: "${run2.stderr1}"` : `exit ${run2.code}, no option error`;
    const caveatText = probe && probe.code !== null && probe.code !== 0 && rejectedName(probe.stderr1) === "" && sameArgClass(arg, probeArgOf(probe.command, tool, flag), tool) ? `The recorded command "${probe.command}" still failed there: "${probe.stderr1}".` : "";
    const caveat = caveatText ? { caveat: caveatText } : {};
    if (info2) return { platform, tool, flag, status: "ok", headline: `${tool} ${flag} exists on ${label2}${argNote}; executed there, ${how}${when}.${caveatText ? " " + caveatText : ""}`, evidence: info2.evidence, run: run2, ...probe ? { probe } : {}, ...caveat };
    if (EXPRESSION_TOOLS.has(tool)) return { platform, tool, flag, status: "ok-probed", headline: `${tool} ${flag} exists on ${label2}: executed there${run2.form === "primary" ? ` as \`${tool} . ${flag} ...\`` : ""}, ${how}${when}.${caveatText ? " " + caveatText : ""}`, evidence: [], run: run2, ...probe ? { probe } : {}, ...caveat };
    return { platform, tool, flag, status: "ok-probed", headline: `${tool} ${flag} is not in ${label2}'s documentation, but the binary accepts it: executed there, ${how}${when}.${caveatText ? " " + caveatText : ""}`, evidence: [], run: run2, ...probe ? { probe } : {}, ...caveat };
  }
  if (probe && probe.code !== null) {
    const name2 = flag.replace(/^-+/, "");
    if (probe.code !== 0 && rejectedName(probe.stderr1) === name2) {
      return { platform, tool, flag, status: "rejected", headline: info2 ? `${tool} ${flag} is documented on ${label2} but the recorded run rejected it: "${probe.stderr1}".` : `${tool} ${flag} was rejected on ${label2}: "${probe.stderr1}".`, evidence: info2?.evidence ?? [], probe };
    }
    if (probe.code === 0 && !info2) {
      return { platform, tool, flag, status: "ok-probed", headline: `${tool} ${flag} is not in ${label2}'s documentation, but the recorded run accepted it (exit 0).`, evidence: [], probe };
    }
  }
  if (info2) {
    return { platform, tool, flag, status: "ok", headline: `${tool} ${flag} is documented on ${label2}${argNote ? ` (${argNote.slice(2)})` : ""}; not executed there.`, evidence: info2.evidence, ...probe ? { probe } : {} };
  }
  if (probe && probe.code !== null && probe.code !== 0 && !info2) {
    return { platform, tool, flag, status: "unknown", headline: `${tool} ${flag}: the only recorded command using it failed on ${label2} for another reason ("${probe.stderr1}"), and no documentation for it was parsed.`, evidence: [], probe };
  }
  if (documentationIsComplete(t) && !EXPRESSION_TOOLS.has(tool)) {
    const usage = Object.values(t.flags).flatMap((f) => f.evidence).find((e) => e.source === "usage" || e.source === "help");
    return { platform, tool, flag, status: "missing", headline: `${tool} ${flag} is not among the options ${label2}'s ${t.sources.join("/")} lists for ${tool}${t.version ? ` (${t.version})` : ""}; not executed there.`, evidence: usage ? [usage] : [], ...probe ? { probe } : {} };
  }
  return { platform, tool, flag, status: "unknown", headline: `No usable option list was recorded for ${tool} on ${label2}.`, evidence: [] };
}
function flagsInWord(word, argTakers) {
  if (word === "-" || word === "--" || !word.startsWith("-")) return [];
  if (word.startsWith("--")) return [word.replace(/=.*$/, "")];
  const out2 = [];
  for (let i2 = 1; i2 < word.length; i2++) {
    const f = "-" + word[i2];
    out2.push(f);
    if (argTakers.has(f)) break;
  }
  return out2;
}

// src/engine/analyze.ts
var PLATFORMS = ["ubuntu", "macos", "alpine"];
var WRAPPERS = {
  sudo: { valueFlags: ["-u", "-g", "-p", "-C", "-D", "-h", "-r", "-t", "-T", "-U"] },
  doas: { valueFlags: ["-u", "-C"] },
  env: { valueFlags: ["-u", "-C", "-S"], envPrefix: true },
  command: { valueFlags: [] },
  builtin: { valueFlags: [] },
  exec: { valueFlags: [] },
  nohup: { valueFlags: [] },
  time: { valueFlags: [] },
  nice: { valueFlags: ["-n"] },
  ionice: { valueFlags: ["-c", "-n", "-p"] },
  stdbuf: { valueFlags: ["-i", "-o", "-e"] },
  timeout: { valueFlags: ["-k", "-s"], skipFirstPositional: 1 },
  setsid: { valueFlags: [] },
  chroot: { valueFlags: [], skipFirstPositional: 1 },
  watch: { valueFlags: ["-n", "-d"] },
  xargs: { valueFlags: ["-I", "-n", "-L", "-P", "-a", "-d", "-s", "-E", "-l", "-i", "-J", "-R", "-S"] }
};
var OLD_STYLE = /* @__PURE__ */ new Set(["tar", "ps"]);
var FIND_PRIMARY_ARGS = Object.fromEntries([
  ...["-name", "-iname", "-path", "-ipath", "-wholename", "-iwholename", "-regex", "-iregex", "-regextype", "-lname", "-ilname", "-type", "-xtype", "-perm", "-size", "-links", "-inum", "-samefile", "-user", "-group", "-uid", "-gid", "-newer", "-anewer", "-cnewer", "-Bnewer", "-mtime", "-atime", "-ctime", "-Btime", "-mmin", "-amin", "-cmin", "-Bmin", "-used", "-fstype", "-flags", "-xattrname", "-context", "-maxdepth", "-mindepth", "-printf", "-fprint", "-fprint0", "-fls"].map((p) => [p, 1]),
  ...["-newermt", "-newerat", "-newerct", "-newerBt", "-newermm", "-newerma", "-newermc", "-newermB", "-neweram", "-neweraa", "-newerac", "-neweraB", "-newercm", "-newerca", "-newercc", "-newercB", "-newerBm", "-newerBa", "-newerBc", "-newerBB"].map((p) => [p, 1]),
  ["-fprintf", 2]
]);
function resolveWord(node) {
  switch (node.type) {
    case "word":
    case "number":
      return { value: node.text, isStatic: true };
    case "raw_string":
      return { value: node.text.slice(1, -1), isStatic: true };
    case "ansi_c_string":
      return { value: decodeAnsiC(node.text.slice(2, -1)), isStatic: true };
    case "string": {
      let out2 = "";
      for (const c of node.children) {
        if (!c) continue;
        if (c.type === '"') continue;
        if (c.type === "string_content") out2 += c.text.replace(/\\([\\"$`\n])/g, "$1");
        else return { value: node.text, isStatic: false };
      }
      return { value: out2, isStatic: true };
    }
    case "concatenation": {
      let out2 = "";
      for (const c of node.children) {
        if (!c) continue;
        const r = resolveWord(c);
        if (!r.isStatic) return { value: node.text, isStatic: false };
        out2 += r.value;
      }
      return { value: out2, isStatic: true };
    }
    default:
      return { value: node.text, isStatic: false };
  }
}
function decodeAnsiC(s) {
  return s.replace(/\\(n|t|r|\\|'|"|a|b|f|v|0|x[0-9A-Fa-f]{1,2})/g, (_, e) => ({ n: "\n", t: "	", r: "\r", "\\": "\\", "'": "'", '"': '"', a: "\x07", b: "\b", f: "\f", v: "\v", "0": "\0" })[e] ?? (e.startsWith("x") ? String.fromCharCode(parseInt(e.slice(1), 16)) : e));
}
function takesArg(db, tool, flag) {
  let best = "none";
  for (const p of PLATFORMS) {
    const a = db.tools[tool]?.[p]?.flags[flag]?.arg;
    if (a === "required") return "required";
    if (a === "optional") best = "optional";
  }
  return best;
}
function presenceOf(db, name2) {
  if (BUILTINS.has(name2) || !db.tools[name2]) return void 0;
  const out2 = {};
  for (const p of PLATFORMS) {
    const t = db.tools[name2]?.[p];
    out2[p] = !t ? "unknown" : t.present ? "present" : "missing";
  }
  return out2;
}
function analyzeWords(db, name2, words, via, start2, end, out2, parser) {
  const finding = { name: name2, start: start2, end, via, flags: [], notes: [], checked: true, tool: presenceOf(db, name2) };
  const w = WRAPPERS[name2];
  if (w && name2 !== "xargs") {
    let i2 = 0;
    let skip = w.skipFirstPositional ?? 0;
    for (; i2 < words.length; i2++) {
      const wd = words[i2];
      if (!wd.isStatic) break;
      if (w.envPrefix && /^[A-Za-z_][A-Za-z0-9_]*=/.test(wd.value)) continue;
      if (wd.value === "--") {
        i2++;
        break;
      }
      if (wd.value.startsWith("-") && wd.value.length > 1) {
        if (db.tools[name2]) addFlags(db, name2, wd, finding, words, i2, (f) => w.valueFlags.includes(f) ? "required" : "none");
        else if (!finding.notes.length) finding.notes.push(`${name2} is not recorded on any platform: its own options are not checked`);
        if (w.valueFlags.includes(wd.value)) i2++;
        continue;
      }
      if (skip > 0) {
        skip--;
        continue;
      }
      break;
    }
    if (name2 === "command" && words.some((x) => x.isStatic && (x.value === "-v" || x.value === "-V"))) {
      finding.notes.push("command -v only asks whether the name exists; the named tool is not executed here");
      out2.push(finding);
      return;
    }
    out2.push(finding);
    const inner = words[i2];
    if (inner && inner.isStatic) analyzeWords(db, inner.value.replace(/^\\/, ""), words.slice(i2 + 1), [...via, name2], inner.start, end, out2, parser);
    else if (inner) out2.push({ name: inner.value, start: inner.start, end: inner.end, via: [...via, name2], flags: [], notes: ["command name is not static: not checked"], checked: false });
    return;
  }
  if ((name2 === "sh" || name2 === "bash" || name2 === "dash" || name2 === "zsh") && parser) {
    const ci = words.findIndex((x) => x.isStatic && x.value === "-c");
    const script = words[ci + 1];
    if (ci >= 0 && script) {
      if (script.isStatic) {
        const sub = analyzeTree(parser.parse(script.value), db, parser, [...via, `${name2} -c`], script.start);
        out2.push(finding, ...sub.commands);
      } else {
        finding.notes.push(`${name2} -c with a dynamic string: not checked`);
        out2.push(finding);
      }
      return;
    }
  }
  if (!db.tools[name2] && !BUILTINS.has(name2)) {
    finding.notes.push(`${name2} is not recorded on any platform: not checked`);
    out2.push(finding);
    return;
  }
  let afterDashDash = false;
  let positional = 0;
  for (let i2 = 0; i2 < words.length; i2++) {
    const wd = words[i2];
    if (!wd.isStatic) {
      if (wd.type === "simple_expansion" || wd.type === "expansion" || /\$[@*]|\[@\]/.test(wd.value)) finding.notes.push(`${wd.value} is dynamic and may carry options: not checked`);
      continue;
    }
    const v = wd.value;
    if (afterDashDash) continue;
    if (v === "--") {
      afterDashDash = true;
      continue;
    }
    if (name2 === "find" && (v === "-exec" || v === "-execdir" || v === "-ok" || v === "-okdir")) {
      let j = i2 + 1;
      const innerWords = [];
      while (j < words.length && !(words[j].isStatic && (words[j].value === ";" || words[j].value === "+"))) {
        innerWords.push(words[j]);
        j++;
      }
      const innerName = innerWords[0];
      if (innerName?.isStatic) analyzeWords(db, innerName.value, innerWords.slice(1), [...via, "find -exec"], innerName.start, end, out2, parser);
      i2 = j;
      continue;
    }
    if (EXPRESSION_TOOLS.has(name2) && v.startsWith("-") && v.length > 2 && !v.startsWith("--")) {
      if (PLATFORMS.some((p) => db.tools[name2]?.[p]?.flags[v] || db.tools[name2]?.[p]?.runs?.[v] || probeFor(db, name2, v, p))) addFlags(db, name2, wd, finding, words, i2, () => "none", v);
      else finding.notes.push(`${v}: ${name2} primary, not recorded on any platform`);
      if (name2 === "find") i2 += FIND_PRIMARY_ARGS[v] ?? 0;
      continue;
    }
    if (v.startsWith("-") && v.length > 1) {
      if (wd.type === "number" && !/^-[A-Za-z]/.test(v) && !PLATFORMS.some((p) => db.tools[name2]?.[p]?.flags[v.slice(0, 2)])) {
        finding.notes.push(`${v}: legacy numeric option (head -5 style), not checked`);
        continue;
      }
      const consumed = addFlags(db, name2, wd, finding, words, i2, (f) => takesArg(db, name2, f));
      i2 += consumed;
      continue;
    }
    if (OLD_STYLE.has(name2) && positional === 0 && /^[A-Za-z]+$/.test(v)) {
      finding.notes.push(`${v}: old-style bundled options (${name2} ${v}), not checked as flags`);
      positional++;
      continue;
    }
    positional++;
    if (name2 === "xargs" && !v.startsWith("-")) {
      analyzeWords(db, v, words.slice(i2 + 1), [...via, "xargs"], wd.start, end, out2, parser);
      out2.unshift(finding);
      return;
    }
  }
  out2.push(finding);
}
function addFlags(db, tool, wd, finding, words, i2, arity2, wholeFlag) {
  const v = wd.value;
  let consumed = 0;
  let flags2;
  if (wholeFlag) flags2 = [wholeFlag];
  else if (v.startsWith("--")) {
    flags2 = [v.replace(/=.*$/, "")];
    if (!v.includes("=") && arity2(flags2[0]) === "required") consumed = 1;
  } else {
    flags2 = [];
    for (let k = 1; k < v.length; k++) {
      const f = "-" + v[k];
      flags2.push(f);
      const a = arity2(f);
      if (a === "required" || a === "optional") {
        if (k === v.length - 1 && a === "required") consumed = 1;
        break;
      }
    }
  }
  for (const flag of flags2) {
    const rest = wholeFlag ? "" : v.startsWith("--") ? v.includes("=") ? v.slice(v.indexOf("=") + 1) : "" : v.slice(v.indexOf(flag[1], 1) + 1);
    const next = words[i2 + 1];
    const shape = rest.length && flags2[flags2.length - 1] === flag ? "attached" : next && next.isStatic && next.value === "" ? "empty" : "bare";
    const last = flags2[flags2.length - 1] === flag;
    const arg = !last ? void 0 : shape === "attached" ? { value: rest, isStatic: true } : next && arity2(flag) !== "none" ? { value: next.value, isStatic: next.isStatic } : void 0;
    const verdicts = Object.fromEntries(PLATFORMS.map((p) => [p, judge(db, tool, flag, p, shape, arg)]));
    finding.flags.push({ flag, word: v, start: wd.start, end: wd.end, verdicts });
  }
  void flagsInWord;
  return consumed;
}
function pos(p, offset) {
  return offset ? { row: p.row + offset.row, column: p.row === 0 ? p.column + offset.column : p.column } : { row: p.row, column: p.column };
}
var NOT_A_FALLBACK = /* @__PURE__ */ new Set(["exit", "return", "die", "fail", "abort", "false", "true", "echo", "printf", ":"]);
var named = (n) => !!n && n.isNamed;
function statementCommand(n) {
  if (n.type === "redirected_statement") {
    const b = n.childForFieldName("body");
    return b ? statementCommand(b) : null;
  }
  return n.type === "command" ? n : null;
}
function probesIn(n, out2 = []) {
  if (n.type === "list") {
    const ops = n.children.filter((k) => k && !k.isNamed).map((k) => k.type);
    if (ops.includes("&&") && !ops.includes("||")) {
      for (const k of n.children) if (named(k)) probesIn(k, out2);
    }
    return out2;
  }
  const c = statementCommand(n);
  if (!c) return out2;
  const nameNode = c.childForFieldName("name");
  const name2 = nameNode ? resolveWord(nameNode.firstChild ?? nameNode).value : "";
  const args2 = c.childrenForFieldName("argument").filter((a) => !!a).map((a) => resolveWord(a));
  if (name2 === "command") {
    const x = args2[1];
    if (args2[0]?.isStatic && (args2[0].value === "-v" || args2[0].value === "-V") && x?.isStatic) out2.push({ kind: "command-v", tool: x.value, node: c });
  } else if (name2 === "which" || name2 === "type" || name2 === "hash") {
    const x = args2.find((a) => a.isStatic && !a.value.startsWith("-"));
    if (x) out2.push({ kind: name2, tool: x.value, node: c });
  }
  return out2;
}
function guardOf(cmd) {
  let child = cmd;
  for (let node = cmd.parent; node; child = node, node = node.parent) {
    if (node.type === "function_definition" || node.type === "program") return void 0;
    if (node.type === "list") {
      const kids = node.children;
      const at = kids.findIndex((k) => k?.id === child.id);
      let op, opAt = -1;
      for (let i2 = at - 1; i2 >= 0; i2--) {
        const k = kids[i2];
        if (k && !k.isNamed && (k.type === "&&" || k.type === "||")) {
          op = k.type;
          opAt = i2;
          break;
        }
      }
      if (!op) continue;
      const left = kids.slice(0, opAt).filter(named);
      if (op === "&&") {
        const probes = left.flatMap((l) => probesIn(l));
        if (probes.length) return { kind: probes[0].kind, tools: probes.map((p) => p.tool), node: probes[0].node };
        continue;
      }
      const leftNode = left[left.length - 1];
      if (leftNode) return { kind: "or-fallback", node: leftNode };
      continue;
    }
    if (node.type === "if_statement" || node.type === "elif_clause") {
      const conds = [];
      for (const k of node.children) {
        if (!k) continue;
        if (!k.isNamed && k.type === "then") break;
        if (k.isNamed) conds.push(k);
      }
      if (conds.some((c) => c.id === child.id)) continue;
      if (child.type === "else_clause" || child.type === "elif_clause") continue;
      const probes = conds.flatMap((c) => probesIn(c));
      if (probes.length) return { kind: probes[0].kind, tools: probes.map((p) => p.tool), node: probes[0].node };
    }
  }
  return void 0;
}
function applyGuard(f, g, offset) {
  if (g.kind === "or-fallback" ? NOT_A_FALLBACK.has(f.name) : !g.tools?.includes(f.name)) return;
  const first = g.node.text.split("\n", 1)[0].trim();
  f.guard = { kind: g.kind, line: pos(g.node.startPosition, offset).row, text: first.length > 60 ? first.slice(0, 57) + "..." : first, ...g.kind !== "or-fallback" ? { tool: f.name } : {} };
}
function analyzeTree(tree, db, parser, via = [], offset) {
  const commands = [];
  const parseErrors = [];
  for (const n of tree.rootNode.descendantsOfType(["ERROR", "MISSING"])) parseErrors.push(pos(n.startPosition, offset));
  if (tree.rootNode.hasError && parseErrors.length === 0) parseErrors.push({ row: 0, column: 0 });
  for (const c of tree.rootNode.descendantsOfType("command")) {
    const nameNode = c.childForFieldName("name");
    if (!nameNode) continue;
    const nameVal = resolveWord(nameNode.firstChild && nameNode.type === "command_name" ? nameNode.firstChild : nameNode);
    const start2 = pos(c.startPosition, offset), end = pos(c.endPosition, offset);
    if (!nameVal.isStatic) {
      commands.push({ name: nameNode.text, start: start2, end, via, flags: [], notes: ["command name is not static: not checked"], checked: false });
      continue;
    }
    const name2 = nameVal.value.replace(/^\\/, "").replace(/^.*\//, "");
    const words = c.childrenForFieldName("argument").filter((a) => !!a).map((a) => {
      const r = resolveWord(a);
      return { ...r, start: pos(a.startPosition, offset), end: pos(a.endPosition, offset), type: a.type };
    });
    const g = guardOf(c);
    const before = g ? new Set(commands) : void 0;
    analyzeWords(db, name2, words, via, start2, end, commands, parser);
    if (g) {
      for (const f of commands) if (!before.has(f) && !f.guard) applyGuard(f, g, offset);
    }
  }
  commands.sort((a, b) => a.start.row - b.start.row || a.start.column - b.start.column);
  const known = new Set(Object.keys(db.tools));
  const SHELLS = /* @__PURE__ */ new Set(["sh", "bash", "dash", "zsh", "ksh"]);
  const unknownTools = [...new Set(commands.filter((c) => c.checked && !known.has(c.name) && !BUILTINS.has(c.name) && !WRAPPERS[c.name] && !SHELLS.has(c.name)).map((c) => c.name))];
  return { commands, parseErrors, unknownTools };
}

// src/engine/shells.ts
var REFERENCE = "ubuntu|/bin/bash";
var PLATFORM_NAME = { ubuntu: "Ubuntu", macos: "macOS", alpine: "Alpine" };
function shortVersion(v) {
  const m = /(\d[\w.+/-]*)/.exec(v.replace(/\(.*$/, ""));
  return (m?.[1] ?? v.split(" ")[0] ?? v).replace(/[-)]$/, "");
}
function detectShebang(src) {
  const first = src.split("\n", 1)[0] ?? "";
  if (!first.startsWith("#!")) return { interp: null, line: null };
  const m = /(?:^|\/|\s)(bash|zsh|sh|dash|ash|ksh)(?:\s|$)/.exec(first.slice(2).trim());
  const name2 = m?.[1];
  if (name2 === "bash") return { interp: "bash", line: first };
  if (name2 === "zsh") return { interp: "zsh", line: first };
  if (name2 === "sh" || name2 === "dash" || name2 === "ash") return { interp: "sh", line: first };
  return { interp: null, line: first };
}
function targetsFor(interp, db) {
  const path2 = (p) => {
    if (interp === "bash") return "/bin/bash";
    if (interp === "zsh") return "/bin/zsh";
    if (interp === "sh") return "/bin/sh";
    return p === "macos" ? "/bin/zsh" : p === "ubuntu" ? "/bin/bash" : "/bin/sh";
  };
  const out2 = [];
  for (const platform of ["ubuntu", "macos", "alpine"]) {
    const shell = path2(platform);
    const info2 = db.shells[platform]?.[shell];
    if (!info2 || info2.kind === "missing") continue;
    out2.push({ key: `${platform}|${shell}`, platform, shell, kind: info2.kind, version: info2.version, label: `${PLATFORM_NAME[platform]} ${info2.kind} ${shortVersion(info2.version)}` });
  }
  return out2;
}
function judgeConstruct(db, probe, target) {
  const rec = db.probes[probe];
  const ref = rec?.results[REFERENCE];
  const got = rec?.results[target.key];
  if (!rec || !ref || !got) return { target, status: "unknown", headline: "not recorded" };
  if (ref.exit === 0 && got.exit !== 0) {
    const why = got.stderr1 || got.stdout1 || `exit ${got.exit}`;
    return { target, status: "breaks", headline: `fails: ${why}`, ref, got };
  }
  if (ref.exit !== 0 && got.exit !== 0) {
    return { target, status: "same", headline: `an error here as in bash (${got.stderr1 || `exit ${got.exit}`})`, ref, got };
  }
  if (ref.exit !== 0 && got.exit === 0) {
    return { target, status: "differs", headline: `an error in bash, accepted here (prints "${got.stdout1}")`, ref, got };
  }
  if (got.stdout1 === ref.stdout1) return { target, status: "same", headline: got.stdout1 ? `prints "${got.stdout1}", as bash does` : "exit 0, as in bash", ref, got };
  return { target, status: "differs", headline: `prints "${got.stdout1}" where bash prints "${ref.stdout1}"`, ref, got };
}
function firstWordOf(node) {
  return node.text.replace(/^\s+/, "").split(/\s+/, 1)[0] ?? "";
}
function insideFunction(n) {
  for (let p = n.parent; p; p = p.parent) if (p.type === "function_definition") return true;
  return false;
}
function leadingOptionLetters(n) {
  let out2 = "";
  for (const c of n.namedChildren) {
    if (!c || c.type !== "word") break;
    if (c.text === "--") break;
    if (!/^-[A-Za-z]+$/.test(c.text)) break;
    out2 += c.text.slice(1);
  }
  return out2;
}
function optionLetters(argText) {
  let out2 = "";
  for (const a of argText) {
    if (a === "--" || !/^-[A-Za-z]+$/.test(a)) break;
    out2 += a.slice(1);
  }
  return out2;
}
var PARAM = String.raw`(?:[A-Za-z_][A-Za-z0-9_]*|\d+|[@*])(?:\[[^\]]*\])?`;
var DEFAULT_RE = new RegExp(String.raw`^\$\{${PARAM}:?-`);
var ALTERNATE_RE = new RegExp(String.raw`^\$\{${PARAM}:?\+`);
var ASSIGN_DEFAULT_RE = new RegExp(String.raw`^\$\{${PARAM}:?=`);
var STRIP_PREFIX_RE = new RegExp(String.raw`^\$\{${PARAM}##?`);
var STRIP_SUFFIX_RE = new RegExp(String.raw`^\$\{${PARAM}%%?`);
var OCTAL_RE = /(^|[^0-9A-Za-z_.#])0\d+(?![0-9A-Za-z_])/;
var LEADING_08_RE = /(^|[^0-9A-Za-z_.#])0[89]\d*(?![0-9A-Za-z_])/;
var BASE_N_RE = /\d+#[0-9A-Za-z]/;
var DIV_ZERO_RE = /\/\s*0(?![0-9A-Za-z_.])/;
var GLOBSTAR_RE = /(^|\/)\*\*(\/|$)/;
var LOWER_RE = /^\$\{[A-Za-z_]\w*(\[[^\]]*\])?,,?\}$/;
var UPPER_RE = /^\$\{[A-Za-z_]\w*(\[[^\]]*\])?\^\^?\}$/;
var ARRAY_LENGTH_RE = /^\$\{#[A-Za-z_]\w*\[[@*]\]\}$/;
var WHOLE_ARRAY_RE = /^\$\{([A-Za-z_]\w*)\[[@*]\]\}$/;
var PREFIX_LIST_RE = /^\$\{![A-Za-z_]\w*[*@]\}$/;
var WHOLE_POSITIONAL_RE = /^\$\{[@*](\}|:\d)/;
var POSITIONAL_GUARD_RE = /^\$\{(?:1\+|[@*]:?\+)/;
var BASH_OWN_ARRAYS = /* @__PURE__ */ new Set(["BASH_SOURCE", "FUNCNAME", "BASH_REMATCH", "PIPESTATUS", "BASH_VERSINFO", "BASH_LINENO", "BASH_ARGV", "BASH_ARGC", "COMP_WORDS", "COMPREPLY", "DIRSTACK", "GROUPS"]);
function statementOf(n) {
  let s = n;
  while (s.parent && !["program", "compound_statement", "do_group", "if_statement", "elif_clause", "else_clause", "case_item", "subshell"].includes(s.parent.type)) s = s.parent;
  return s;
}
function previousStatement(n) {
  let prev = statementOf(n).previousNamedSibling;
  while (prev && prev.type === "comment") prev = prev.previousNamedSibling;
  return prev;
}
var SUBST_TYPES = ["expansion", "simple_expansion", "command_substitution"];
function arithText(n) {
  const subs = n.descendantsOfType(SUBST_TYPES).filter((d) => {
    if (!d) return false;
    for (let p = d.parent; p && p !== n; p = p.parent) if (SUBST_TYPES.includes(p.type)) return false;
    return true;
  });
  let out2 = "", cur = 0;
  for (const d of subs) {
    out2 += n.text.slice(cur, d.startIndex - n.startIndex) + "v";
    cur = d.endIndex - n.startIndex;
  }
  return out2 + n.text.slice(cur);
}
function valueRunsCommand(assign) {
  const value = assign.childForFieldName("value");
  return !!value && (value.type === "command_substitution" || value.descendantsOfType("command_substitution").length > 0);
}
function isLiteralNonEmpty(value) {
  if (value.type === "word" || value.type === "number") return value.text.length > 0;
  if (value.type === "raw_string") return value.text.length > 2;
  if (value.type === "ansi_c_string") return value.text.length > 3;
  if (value.type === "string") return value.text.length > 2 && value.descendantsOfType([...SUBST_TYPES, "arithmetic_expansion"]).length === 0;
  return false;
}
function isDefaultIfs(value) {
  if (value.type === "ansi_c_string") return value.text === String.raw`$' \t\n'`;
  if (value.type === "raw_string" || value.type === "string") return value.text.slice(1, -1) === " ";
  return false;
}
function fullExpansionText(n) {
  const close = n.children[n.children.length - 1];
  if (close?.type === "}" && close.text === "}") return n.text.replace(/^\s+/, "");
  const parent = n.parent;
  if (!parent) return null;
  const from = parent.text.slice(n.startIndex - parent.startIndex).replace(/^\s+/, "");
  let depth = 0;
  for (let i2 = 0; i2 < from.length; i2++) {
    const ch = from[i2];
    if (ch === "\n") return null;
    if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return from.slice(0, i2 + 1);
  }
  return null;
}
function substringKind(full) {
  const m = /^\$\{(?:[A-Za-z_]\w*|\d+):(?![-=?+])(.*)\}$/s.exec(full);
  if (!m) return null;
  const ops = [];
  let depth = 0, cur = "";
  for (const ch of m[1]) {
    if (ch === "{" || ch === "(") depth++;
    else if (ch === "}" || ch === ")") depth--;
    if (ch === ":" && depth === 0) {
      ops.push(cur);
      cur = "";
    } else cur += ch;
  }
  ops.push(cur);
  if (ops.length > 2 || !ops[0].trim()) return null;
  if (/^[-(]/.test(ops[0].trim())) return "substr_negative";
  if (ops.length === 2 && ops[1].trim().startsWith("-")) return "substring_neg_len";
  return "substring";
}
function splittable(simpleExpansion) {
  const name2 = simpleExpansion.text.trimStart().slice(1);
  return !/^[?$!#-]$/.test(name2) && !/^\d+$/.test(name2);
}
function echoSeesBackslash(arg) {
  if (arg.type === "string") {
    let rest = "", cur = 0;
    for (const c of arg.namedChildren) {
      if (!c || c.type === "string_content") continue;
      rest += arg.text.slice(cur, c.startIndex - arg.startIndex);
      cur = c.endIndex - arg.startIndex;
    }
    rest += arg.text.slice(cur);
    return /\\[^$"`\\\n]/.test(rest);
  }
  if (arg.type === "raw_string") return arg.text.includes("\\");
  if (arg.type === "word") return arg.text.includes("\\\\");
  if (arg.type === "concatenation") return arg.namedChildren.some((c) => !!c && echoSeesBackslash(c));
  return false;
}
function findConstructs(tree) {
  const hits = [];
  const add = (probe, node, text) => hits.push(text ? { probe, node, text } : { probe, node });
  const root = tree.rootNode;
  let nounset = false, errexit = false, positionalSet = false;
  for (const n of root.descendantsOfType("command")) {
    if (n.childForFieldName("name")?.text !== "set") continue;
    const argText = n.childrenForFieldName("argument").filter((a) => !!a).map((a) => a.text);
    if (argText[0] === "--" && argText.length > 1) positionalSet = true;
    const letters = optionLetters(argText);
    if (letters.includes("u")) nounset = true;
    if (letters.includes("e")) errexit = true;
    for (let i2 = 0; i2 < argText.length; i2++) {
      if (argText[i2] === "--") break;
      if (argText[i2] === "-o" && argText[i2 + 1] === "nounset") nounset = true;
      if (argText[i2] === "-o" && argText[i2 + 1] === "errexit") errexit = true;
    }
  }
  const funcNames = /* @__PURE__ */ new Set();
  for (const n of root.descendantsOfType("function_definition")) {
    const name2 = n.childForFieldName("name")?.text;
    if (name2) funcNames.add(name2);
  }
  const assocNames = /* @__PURE__ */ new Set();
  for (const n of root.descendantsOfType("declaration_command")) {
    const first = firstWordOf(n);
    if ((first === "declare" || first === "typeset" || first === "local") && leadingOptionLetters(n).includes("A")) {
      for (const c of n.namedChildren) {
        if (!c) continue;
        if (c.type === "variable_name") assocNames.add(c.text);
        else if (c.type === "variable_assignment") {
          const nm = c.childForFieldName("name")?.text;
          if (nm) assocNames.add(nm);
        }
      }
    }
  }
  for (const n of root.descendantsOfType("array")) add("array_literal", n);
  const literalArrays = /* @__PURE__ */ new Set();
  for (const n of root.descendantsOfType("variable_assignment")) {
    const name2 = n.childForFieldName("name"), value = n.childForFieldName("value");
    if (name2?.type === "variable_name" && value?.type === "array" && value.namedChildren.length > 0) literalArrays.add(name2.text);
  }
  for (const n of root.descendantsOfType("subscript")) {
    const name2 = n.childForFieldName("name")?.text ?? "";
    if (BASH_OWN_ARRAYS.has(name2)) continue;
    const ix = n.childForFieldName("index");
    const idx = ix?.text ?? "";
    if (/^\d+$/.test(idx)) add("array_index", n);
    else if (/^-\d+$/.test(idx)) add("array_negative_index", n);
    else if (idx === "@" || idx === "*") {
      if (n.parent?.type === "expansion" && /^\$\{#/.test(n.parent.text.trimStart())) continue;
      if (idx === "*" && n.parent?.type === "expansion" && n.parent.parent?.type === "string") add("array_star_ifs", n);
      else add("array_all", n);
    } else if (ix && !assocNames.has(name2) && (ix.type === "simple_expansion" || ix.type === "expansion" || ix.type === "word")) add("array_var_index", n);
  }
  for (const n of root.descendantsOfType("expansion")) {
    const t = n.text.replace(/^\s+/, "");
    const operator = n.childForFieldName("operator")?.text;
    const colons = n.children.filter((c) => !!c && c.type === ":");
    const named2 = n.namedChildren.filter((c) => !!c);
    const sub = named2[0];
    const wholePositional = sub?.type === "special_variable_name" && /^[@*]$/.test(sub.text);
    const wholeArray = sub?.type === "subscript" && /^[@*]$/.test(sub.childForFieldName("index")?.text ?? "");
    if (/^\$\{![A-Za-z_][A-Za-z0-9_]*\[[@*]\]\}$/.test(t)) add("array_keys", n);
    else if (PREFIX_LIST_RE.test(t)) {
    } else if (/^\$\{!/.test(t)) add("indirect_bash", n);
    else if (LOWER_RE.test(t)) add("lowercase_bash4", n);
    else if (UPPER_RE.test(t)) add("uppercase_bash4", n);
    else if (/@[QEPAa]\}$/.test(t)) add("at_upper_q", n);
    else if (/@[UuL]\}$/.test(t)) add("at_upper_u", n);
    else if (ARRAY_LENGTH_RE.test(t)) add("array_length", n);
    else if (/^\$\{#(?:[A-Za-z_][A-Za-z0-9_]*|\d+)\}$/.test(t)) add("string_length", n);
    else if (operator === ":" && (wholeArray || wholePositional)) add("array_slice", n);
    else if (operator === ":" && colons.length === 2 && named2.some((c) => c.type === "number" && c.text.startsWith("-") && c.startIndex > colons[1].startIndex)) add("substring_neg_len", n);
    else if (operator === ":" && sub?.type !== "subscript" && named2.some((c) => c.type === "number" && c.text.startsWith("-") || c.type === "parenthesized_expression")) add("substr_negative", n);
    else if (operator === ":" && sub?.type === "variable_name") {
      const full = fullExpansionText(n);
      const kind = full && substringKind(full);
      if (kind) add(kind, n, full === n.text.replace(/^\s+/, "") ? void 0 : full);
    } else if (/^\$\{[A-Za-z_][A-Za-z0-9_]*\/\//.test(t) || /^\$\{[A-Za-z_][A-Za-z0-9_]*\/[^}]*\/[^}]*\}$/.test(t)) add("pattern_replace", n);
    else if (DEFAULT_RE.test(t)) add("default_value", n);
    else if (ALTERNATE_RE.test(t)) add("alternate_value", n);
    else if (ASSIGN_DEFAULT_RE.test(t)) add("assign_default", n);
    else if (STRIP_PREFIX_RE.test(t)) add("strip_prefix", n);
    else if (STRIP_SUFFIX_RE.test(t)) add("strip_suffix", n);
    if (nounset) {
      if (!positionalSet && WHOLE_POSITIONAL_RE.test(t)) add("set_u_empty_at", n);
      const whole = WHOLE_ARRAY_RE.exec(t);
      if (whole && !literalArrays.has(whole[1])) {
        const guard = new RegExp(String.raw`^\$\{${whole[1]}\[[@*]\]:?\+`);
        let guarded = false;
        for (let p = n.parent; p; p = p.parent) if (p.type === "expansion" && guard.test(p.text.trimStart())) {
          guarded = true;
          break;
        }
        if (!guarded) add("set_u_empty_array", n);
      }
    }
    const name2 = n.descendantsOfType("variable_name")[0]?.text;
    if (name2 === "PIPESTATUS") add("pipestatus_upper", n);
    else if (name2 === "BASH_SOURCE") add("bash_source", n);
    else if (name2 === "FUNCNAME") add("funcname", n);
    else if (name2 === "RANDOM") add("random", n);
    else if (name2 === "EPOCHSECONDS") add("epochseconds", n);
    else if (name2 === "BASH_REMATCH") add("bash_rematch", n);
    else if (name2 === "HOSTNAME") add("hostname_var", n);
    else if (name2 === "EUID") add("euid_var", n);
    else if (name2 === "SECONDS") add("seconds_var", n);
    else if (name2 === "OSTYPE") add("ostype_var", n);
  }
  for (const n of root.descendantsOfType("simple_expansion")) {
    const name2 = n.text.trimStart().slice(1);
    if (name2 === "RANDOM") add("random", n);
    else if (name2 === "EPOCHSECONDS") add("epochseconds", n);
    else if (name2 === "BASH_REMATCH") add("bash_rematch", n);
    else if (name2 === "HOSTNAME") add("hostname_var", n);
    else if (name2 === "EUID") add("euid_var", n);
    else if (name2 === "SECONDS") add("seconds_var", n);
    else if (name2 === "OSTYPE") add("ostype_var", n);
    else if (name2 === "?") {
      if (previousStatement(n)?.type === "pipeline") add("last_pipe_status", n);
    }
    if (nounset && !positionalSet && (name2 === "@" || name2 === "*")) {
      let guarded = false;
      for (let p = n.parent; p; p = p.parent) if (p.type === "expansion" && POSITIONAL_GUARD_RE.test(p.text.trimStart())) {
        guarded = true;
        break;
      }
      if (!guarded) add("set_u_empty_at", n);
    }
  }
  for (const n of root.descendantsOfType("process_substitution")) add("process_subst", n);
  for (const n of root.descendantsOfType("herestring_redirect")) add("here_string", n);
  for (const n of root.descendantsOfType("brace_expression")) add("brace_expand", n);
  for (const n of root.descendantsOfType("ansi_c_string")) add("dollar_quote", n);
  for (const n of root.descendantsOfType("command_substitution")) if (n.text.startsWith("`")) add("backticks", n);
  for (const n of root.descendantsOfType("subshell")) add("subshell_scope", n);
  for (const n of root.descendantsOfType("negated_command")) add("negation", n);
  for (const n of root.descendantsOfType("c_style_for_statement")) add("c_style_for", n);
  for (const n of root.descendantsOfType("while_statement")) if (n.text.startsWith("until")) add("until_loop", n);
  for (const n of root.descendantsOfType("case_statement")) add("case_basic", n);
  for (const n of root.descendantsOfType("case_item")) {
    const t = n.text.trimEnd();
    if (t.endsWith(";;&")) add("case_fallthrough_test", n);
    else if (t.endsWith(";&")) add("case_fallthrough_amp", n);
  }
  for (const n of root.descendantsOfType("extglob_pattern")) if (/[@+?!*]\(/.test(n.text)) add("shopt_extglob", n);
  for (const n of root.descendantsOfType("arithmetic_expansion")) {
    const t = arithText(n);
    const power = t.includes("**"), lz08 = LEADING_08_RE.test(t), octal = !lz08 && OCTAL_RE.test(t), div0 = DIV_ZERO_RE.test(t), baseN = BASE_N_RE.test(t);
    if (power) add("power_arith", n);
    if (octal) add("octal_literal", n);
    if (lz08) add("leading_zero_08", n);
    if (div0) add("div_zero", n);
    if (baseN) add("base_n_literal", n);
    if (!power && !octal && !lz08 && !div0 && !baseN) add("arith_basic", n);
  }
  for (const n of root.descendantsOfType("compound_statement")) {
    if (!n.text.startsWith("((")) continue;
    add("paren_arith", n);
    const t = arithText(n);
    if (LEADING_08_RE.test(t)) add("leading_zero_08", n);
    if (DIV_ZERO_RE.test(t)) add("div_zero", n);
    if (BASE_N_RE.test(t)) add("base_n_literal", n);
  }
  for (const n of root.descendantsOfType("test_command")) {
    const t = n.text;
    if (t.startsWith("[[")) {
      add("double_bracket", n);
      if (/\s=~\s/.test(t)) add("regex_match", n);
      if (/\[\[\s+-v\s/.test(t)) add("test_v", n);
      const binaries = n.descendantsOfType("binary_expression");
      if (binaries.some((b) => {
        const op = b.childForFieldName("operator")?.text;
        return op === "&&" || op === "||";
      })) add("dbl_bracket_and", n);
      if (binaries.some((b) => {
        const r = b.childForFieldName("right");
        return b.childForFieldName("operator")?.text === "!=" && !!r && (r.type === "extglob_pattern" || r.type === "word" && /[*?[]/.test(r.text));
      })) add("dbl_bracket_neq_pattern", n);
    } else if (t.startsWith("[")) {
      if (/\s==\s/.test(t)) add("single_bracket_eqeq", n);
      if (/^\[\s+-[nz]\s/.test(t)) add("test_n_z", n);
      if (/^\[\s+-t\s/.test(t)) add("test_t", n);
    }
  }
  for (const n of root.descendantsOfType("function_definition")) {
    if (/^function\s/.test(n.text)) add("function_keyword", n);
    else add("function_posix", n);
  }
  for (const n of root.descendantsOfType("variable_assignment")) {
    const t = n.text;
    const name2 = n.childForFieldName("name");
    const value = n.childForFieldName("value");
    if (/^[A-Za-z_]\w*\+=\(/.test(t)) add("array_append", n);
    else if (/^[A-Za-z_]\w*(\[[^\]]*\])?\+=/.test(t) && value?.type !== "array") add("string_append", n);
    if (name2?.type === "variable_name" && name2.text === "IFS" && value && n.parent?.type !== "command" && isLiteralNonEmpty(value) && !isDefaultIfs(value)) add("ifs_split", n);
  }
  for (const n of root.descendantsOfType("declaration_command")) {
    const first = firstWordOf(n);
    const letters = leadingOptionLetters(n);
    const assigns = n.namedChildren.filter((c) => !!c && c.type === "variable_assignment");
    const masksStatus = assigns.some(valueRunsCommand);
    if (first === "declare" || first === "typeset") {
      if (letters.includes("A")) add("assoc_declare", n);
      if (letters.includes("n")) add("declare_n", n);
      if (letters.includes("g")) add("declare_g", n);
      if (letters.includes("a")) add("declare_a", n);
      if (letters.includes("i")) add("declare_i", n);
      if (letters.includes("x")) add("declare_x", n);
      if (letters.includes("p")) add("declare_p", n);
      if (letters.includes("F")) add("declare_upper_f", n);
      if (letters.includes("r")) add("readonly_declare", n);
      if (first === "typeset") add("typeset_builtin", n);
      if (masksStatus && insideFunction(n)) add("local_masks_status", n);
    } else if (first === "export") {
      if (letters.includes("f")) add("export_f", n);
      else if (assigns.length) add("export_assign", n);
      if (masksStatus) add("export_masks_status", n);
    } else if (first === "local") {
      if (insideFunction(n)) add("local_in_func", n);
      else add("local_outside", n);
      if (letters.includes("A")) add("assoc_declare", n);
      if (letters.includes("a")) add("declare_a", n);
      if (letters.includes("i")) add("declare_i", n);
      if (letters.includes("r")) add("readonly_declare", n);
      if (masksStatus) add("local_masks_status", n);
    } else if (first === "readonly") add("readonly_declare", n);
  }
  for (const n of root.descendantsOfType("unset_command")) {
    const t = n.text;
    if (/^unset\s+-[a-z]*v\b/.test(t)) add("unset_v", n);
    if (/^unset\s+-[a-z]*f\b/.test(t)) add("unset_f", n);
    if (/^unset(?:\s+-\w+)*\s+["']?[A-Za-z_]\w*\[/.test(t)) add("unset_array_element", n);
  }
  for (const n of root.descendantsOfType("command")) {
    const name2 = n.childForFieldName("name")?.text ?? "";
    const args2 = n.childrenForFieldName("argument").filter((a) => !!a);
    const argText = args2.map((a) => a.text);
    const has = (re) => argText.some((a) => re.test(a));
    switch (name2) {
      case "mapfile":
      case "readarray":
        add("mapfile", n);
        break;
      case "shopt": {
        let specific = false;
        if (argText.includes("nullglob")) {
          add("shopt_nullglob", n);
          specific = true;
        }
        if (argText.includes("extglob")) {
          add("shopt_extglob", n);
          specific = true;
        }
        if (argText.includes("globstar")) {
          add("shopt_globstar", n);
          specific = true;
        }
        if (!specific) add("shopt", n);
        break;
      }
      case "let":
        add("let_builtin", n);
        break;
      case "compgen":
        add("compgen", n);
        break;
      case "complete":
        add("complete_builtin", n);
        break;
      case "coproc":
        add("coproc", n);
        break;
      case "source":
        add("source_keyword", n);
        break;
      case ".":
        add("source_dot", n);
        break;
      case "alias":
        add("alias_in_script", n);
        break;
      case "eval":
        add("eval_basic", n);
        break;
      case "caller":
        add("caller_builtin", n);
        break;
      case "builtin":
        add("builtin_keyword", n);
        break;
      case "pushd":
      case "popd":
      case "dirs":
        add("pushd_popd", n);
        break;
      case "getopts":
        add("getopts", n);
        break;
      case "hash":
        if (has(/^-[a-z]*r/)) add("hash_r", n);
        break;
      case "wait":
        if (has(/^-[a-zA-Z]*n/)) add("wait_n", n);
        break;
      case "command":
        if (argText[0] && /^-\w*v/.test(argText[0])) add("command_v", n);
        break;
      case "shift":
        if (args2.length) add("shift_n", n);
        break;
      case "trap": {
        if (argText[0] === "-") break;
        if (argText.includes("EXIT") || argText.includes("0")) add(insideFunction(n) ? "trap_exit_in_function" : "trap_exit", n);
        if (argText.includes("ERR")) add("trap_err", n);
        break;
      }
      case "test": {
        if (argText[0] === "-n" || argText[0] === "-z") add("test_n_z", n);
        if (argText[0] === "-t") add("test_t", n);
        break;
      }
      case "read": {
        if (has(/^-\w*a/)) add("read_a", n);
        if (has(/^-\w*p/)) add("read_p", n);
        if (has(/^-\w*r/)) add("read_r", n);
        if (has(/^-[a-zA-Z]*N/)) add("read_upper_n", n);
        if (has(/^-[a-zA-Z]*n\d*$/)) add("read_n", n);
        const di = argText.findIndex((a) => /^-[a-zA-Z]*d/.test(a));
        if (di >= 0) {
          const attached = argText[di].replace(/^-[a-zA-Z]*d/, "");
          const delim = attached || argText[di + 1] || "";
          if (/^(''|"")$/.test(delim)) add("read_d_null", n);
          else add("read_d", n);
        }
        const operands = [];
        for (let i2 = 0; i2 < argText.length; i2++) {
          const a = argText[i2];
          if (/^-[a-zA-Z]+$/.test(a)) {
            if (/[dnNtuipa]$/.test(a)) i2++;
            continue;
          }
          if (/^-[a-zA-Z]*[dnNtuipa]/.test(a)) continue;
          operands.push(a);
        }
        if (!operands.length && !has(/^-\w*a/)) add("read_reply", n);
        break;
      }
      case "printf": {
        let specific = false;
        if (has(/^-v$/)) {
          add("printf_v", n);
          specific = true;
        }
        if (has(/%-?\d*q/)) {
          add("printf_q", n);
          specific = true;
        }
        if (has(/%\([^)]*\)T/)) {
          add("printf_time", n);
          specific = true;
        }
        const fmt = argText.find((a) => a.includes("%"));
        if (!specific && fmt && (/%[-+ 0#]*\d/.test(fmt) || /%\.\d/.test(fmt))) add("printf_basic", n);
        break;
      }
      case "echo": {
        let opts = "", nOpts = 0;
        for (const a of argText) {
          if (!/^-[neE]+$/.test(a)) break;
          opts += a.slice(1);
          nOpts++;
        }
        if (opts.includes("e")) add("echo_dash_e", n);
        if (opts.includes("n")) add("echo_dash_n", n);
        const interprets = opts.replace(/[^eE]/g, "").endsWith("e");
        if (!interprets && args2.slice(nOpts).some(echoSeesBackslash)) add("echo_backslash", n);
        break;
      }
      case "set": {
        if (argText.join(" ").includes("pipefail")) add("pipefail", n);
        const letters = optionLetters(argText);
        let nounsetHere = letters.includes("u");
        for (let i2 = 0; i2 < argText.length; i2++) {
          if (argText[i2] === "--") break;
          if (argText[i2] === "-o" && argText[i2 + 1] === "nounset") nounsetHere = true;
        }
        if (nounsetHere) add("set_o_nounset", n);
        let errexitHere = letters.includes("e");
        for (let i2 = 0; i2 < argText.length; i2++) {
          if (argText[i2] === "--") break;
          if (argText[i2] === "-o" && argText[i2 + 1] === "errexit") errexitHere = true;
        }
        if (errexitHere) add("set_e_basic", n);
        break;
      }
      case "type":
        if (has(/^-\w*t/)) add("type_t", n);
        if (has(/^-[A-Za-z]*P/)) add("type_upper_p", n);
        break;
      case "local":
        if (!insideFunction(n)) add("local_outside", n);
        break;
    }
    for (const a of args2) if (a.type === "simple_expansion" && splittable(a)) add("word_split", a);
    for (const a of args2) if (a.type === "word" && /[*?]/.test(a.text) && !/^-/.test(a.text)) add("glob_nomatch", a);
    for (const a of args2) if (a.type === "word" && GLOBSTAR_RE.test(a.text)) add("shopt_globstar", a);
  }
  for (const n of root.descendantsOfType("pipeline")) {
    const last = n.namedChildren[n.namedChildren.length - 1];
    if (last?.type === "command" && last.childForFieldName("name")?.text === "read") add("pipe_read", last);
    if (last?.type === "while_statement") {
      const read = last.childrenForFieldName("condition").find((c) => !!c && c.type === "command" && c.childForFieldName("name")?.text === "read");
      if (read) add("pipe_read", read);
    }
    if (n.children.some((c) => c?.type === "|&")) add("pipe_both", n);
  }
  for (const n of root.descendantsOfType("file_redirect")) {
    const t = n.text;
    const dest = n.childForFieldName("destination");
    if (/^\d*>&\d+$/.test(t)) add("fd_dup", n);
    else if (t.startsWith("&>") || t.startsWith(">&") && dest?.type === "word" && dest.text !== "-") add("amp_redirect", n);
  }
  for (const n of root.descendantsOfType("for_statement")) {
    for (const w of n.childrenForFieldName("value")) {
      if (!w) continue;
      const globWords = w.type === "word" ? [w] : w.type === "concatenation" ? w.namedChildren.filter((c) => !!c && c.type === "word") : [];
      if (globWords.some((g) => /[*?[]/.test(g.text))) add("glob_nomatch_for", w);
      if (w.type === "word" && GLOBSTAR_RE.test(w.text)) add("shopt_globstar", w);
      if (w.type === "simple_expansion" && splittable(w)) add("word_split", w);
    }
  }
  if (errexit) {
    for (const n of root.descendantsOfType("list")) {
      const first = n.namedChildren[0];
      const op = n.children.find((c) => c?.type === "||" || c?.type === "&&");
      if (op && first?.type === "command" && funcNames.has(first.childForFieldName("name")?.text ?? "")) add("set_e_function_or", n);
    }
  }
  const seen = /* @__PURE__ */ new Set();
  return hits.filter((h) => {
    const k = `${h.probe}@${h.node.startIndex}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
function analyzeShells(tree, db, targets, offset) {
  const pos2 = (p) => offset ? { row: p.row + offset.row, column: p.row === 0 ? p.column + offset.column : p.column } : { row: p.row, column: p.column };
  const out2 = [];
  for (const h of findConstructs(tree)) {
    const rec = db.probes[h.probe];
    if (!rec) continue;
    const text = h.text ?? h.node.text;
    const end = h.text ? { row: h.node.startPosition.row, column: h.node.startPosition.column + h.text.length } : h.node.endPosition;
    out2.push({
      probe: h.probe,
      label: rec.label,
      snippet: rec.snippet,
      text: text.length > 80 ? text.slice(0, 77) + "\u2026" : text,
      start: pos2(h.node.startPosition),
      end: pos2(end),
      verdicts: targets.map((t) => judgeConstruct(db, h.probe, t))
    });
  }
  out2.sort((a, b) => a.start.row - b.start.row || a.start.column - b.start.column);
  return out2;
}

// src/engine/counts.ts
function classifyTool(c, p) {
  if (c.tool?.[p] !== "missing") return null;
  return c.guard ? "guarded" : "break";
}
function classifyFlag(c, f, p) {
  const v = f.verdicts[p];
  if (v.status === "rejected") return c.guard ? "guarded" : "break";
  if (v.status === "missing") return "undocumented";
  if (v.caveat && v.status !== "missing-tool") return c.guard ? "guarded" : "caveat";
  return null;
}
function countPlatform(a, p) {
  const n = { breaks: 0, undocumented: 0, caveats: 0, guarded: 0 };
  const bump = (k) => {
    if (k === "break") n.breaks++;
    else if (k === "caveat") n.caveats++;
    else if (k === "undocumented") n.undocumented++;
    else if (k === "guarded") n.guarded++;
  };
  for (const c of a.commands) {
    bump(classifyTool(c, p));
    for (const f of c.flags) bump(classifyFlag(c, f, p));
  }
  return n;
}
function guardPhrase(c) {
  if (!c.guard) return "";
  return c.guard.kind === "or-fallback" ? `runs only if \`${c.guard.text}\` fails (line ${c.guard.line + 1})` : `is guarded by \`${c.guard.text}\` on line ${c.guard.line + 1}`;
}

// src/action/core.ts
var PLATFORM_NAME2 = { ubuntu: "Ubuntu", macos: "macOS", alpine: "Alpine" };
var DEFAULT_PLATFORMS = ["macos", "alpine"];
async function loadEngine(paths) {
  await Parser.init({ locateFile: () => paths.treeSitterWasm });
  const lang = await Language.load(paths.bashWasm);
  const parser = new Parser();
  parser.setLanguage(lang);
  const db = JSON.parse(readFileSync(paths.flagsJson, "utf8"));
  const shellsDb = existsSync(paths.shellsJson) ? JSON.parse(readFileSync(paths.shellsJson, "utf8")) : void 0;
  return { parser, db, shellsDb };
}
function parsePlatforms(input) {
  const wanted = input.split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (wanted.length === 0) return [...DEFAULT_PLATFORMS];
  const bad = wanted.filter((w) => !PLATFORMS.includes(w));
  if (bad.length) throw new Error(`unknown platform ${bad.map((b) => `"${b}"`).join(", ")}; use ${PLATFORMS.join(", ")}`);
  return PLATFORMS.filter((p) => wanted.includes(p));
}
var emptyCount = () => ({ breaks: 0, undocumented: 0, caveats: 0, guarded: 0, shellBreaks: 0 });
var SEVERITY_ORDER = { error: 0, warning: 1, notice: 2 };
function checkSource(src, file, engine, opts) {
  const { parser, db, shellsDb } = engine;
  const tree = parser.parse(src);
  if (!tree) throw new Error(`${file}: the parser returned nothing`);
  const a = analyzeTree(tree, db, parser);
  const findings = [];
  const perPlatform = {};
  for (const p of opts.platforms) perPlatform[p] = emptyCount();
  for (const p of opts.platforms) perPlatform[p] = { ...countPlatform(a, p), shellBreaks: 0 };
  for (const c of a.commands) {
    const at = { file, line: c.start.row + 1, column: c.start.column + 1, endLine: c.end.row + 1, endColumn: c.end.column + 1 };
    const guarded = guardPhrase(c);
    for (const p of opts.platforms) {
      const t = classifyTool(c, p);
      const missing = `${c.name} is not on ${PLATFORM_NAME2[p]} at all: the tool itself is missing there, so every use of it breaks.`;
      if (t === "break") findings.push({ ...at, severity: "error", kind: "missing-tool", platform: p, subject: c.name, title: `${c.name} is not on ${PLATFORM_NAME2[p]}`, message: missing });
      else if (t === "guarded" && opts.verbose) findings.push({ ...at, severity: "notice", kind: "guarded", platform: p, subject: c.name, title: `${c.name} is not on ${PLATFORM_NAME2[p]}, but it is guarded`, message: `${c.name} is not on ${PLATFORM_NAME2[p]} at all, but this command ${guarded}.` });
      for (const f of c.flags) {
        const v = f.verdicts[p];
        const fat = { file, line: f.start.row + 1, column: f.start.column + 1, endLine: f.end.row + 1, endColumn: f.end.column + 1 };
        const base = { ...fat, platform: p, subject: c.name, flag: f.flag, message: v.headline };
        switch (classifyFlag(c, f, p)) {
          case "break":
            findings.push({ ...base, severity: "error", kind: "rejected", title: `${c.name} ${f.flag} breaks on ${PLATFORM_NAME2[p]}` });
            break;
          case "undocumented":
            findings.push({ ...base, severity: "warning", kind: "undocumented", title: `${c.name} ${f.flag} is not documented on ${PLATFORM_NAME2[p]}` });
            break;
          case "caveat":
            findings.push({ ...base, severity: "warning", kind: "caveat", title: `${c.name} ${f.flag} exists on ${PLATFORM_NAME2[p]}, but this use failed there` });
            break;
          case "guarded":
            if (opts.verbose) findings.push({ ...base, severity: "notice", kind: "guarded", title: `${c.name} ${f.flag} on ${PLATFORM_NAME2[p]}: guarded`, message: `${v.headline} This command ${guarded}.` });
            break;
          default:
            break;
        }
      }
    }
    if (opts.verbose) for (const note of c.notes)
      findings.push({ ...at, severity: "notice", kind: "unchecked", subject: c.name, title: `${c.name}: not checked`, message: note });
  }
  if (opts.verbose) {
    const unchecked = a.commands.filter((c) => !c.checked);
    for (const c of unchecked) if (c.notes.length === 0)
      findings.push({ file, line: c.start.row + 1, column: c.start.column + 1, endLine: c.end.row + 1, endColumn: c.end.column + 1, severity: "notice", kind: "unchecked", subject: c.name, title: `${c.name}: not checked`, message: "the command name is not static, so it was not checked" });
    for (const t of a.unknownTools) {
      const c = a.commands.find((x) => x.name === t);
      findings.push({ file, line: c.start.row + 1, column: c.start.column + 1, endLine: c.end.row + 1, endColumn: c.end.column + 1, severity: "notice", kind: "unknown-tool", subject: t, title: `${t}: not in the database`, message: `${t} is not one of the recorded tools, so its flags were not checked.` });
    }
  }
  const interp = detectShebang(src).interp;
  if (shellsDb) {
    const targets = targetsFor(interp, shellsDb).filter((t) => opts.platforms.includes(t.platform));
    for (const cf of analyzeShells(tree, shellsDb, targets)) {
      const at = { file, line: cf.start.row + 1, column: cf.start.column + 1, endLine: cf.end.row + 1, endColumn: cf.end.column + 1, subject: cf.label };
      for (const v of cf.verdicts) {
        if (v.status === "breaks") {
          perPlatform[v.target.platform].shellBreaks++;
          findings.push({ ...at, severity: "error", kind: "shell-breaks", platform: v.target.platform, title: `${cf.label}: breaks under ${v.target.label}`, message: `${v.target.label}: ${v.headline}` });
        } else if (v.status === "differs") {
          findings.push({ ...at, severity: "warning", kind: "shell-differs", platform: v.target.platform, title: `${cf.label}: differs under ${v.target.label}`, message: `${v.target.label}: ${v.headline}` });
        }
      }
    }
  }
  if (a.parseErrors.length) {
    const first = a.parseErrors[0];
    findings.push({
      file,
      line: first.row + 1,
      column: first.column + 1,
      endLine: first.row + 1,
      endColumn: first.column + 1,
      severity: "warning",
      kind: "parse-error",
      subject: file,
      title: "the script did not parse cleanly",
      message: `parse error at line ${first.row + 1}${a.parseErrors.length > 1 ? ` (and ${a.parseErrors.length - 1} more)` : ""}; the results for this file may be partial.`
    });
  }
  findings.sort((x, y) => x.line - y.line || x.column - y.column || SEVERITY_ORDER[x.severity] - SEVERITY_ORDER[y.severity]);
  return {
    file,
    interp,
    commands: a.commands.length,
    flags: a.commands.reduce((n, c) => n + c.flags.length, 0),
    unchecked: a.commands.reduce((n, c) => n + c.notes.length, 0) + a.commands.filter((c) => !c.checked).length,
    parseErrors: a.parseErrors.length,
    perPlatform,
    findings
  };
}
function checkFiles(files, engine, opts) {
  const reports = files.map((f) => checkSource(f.src, f.path, engine, opts));
  const perPlatform = {};
  for (const p of opts.platforms) {
    const sum = emptyCount();
    for (const r of reports) {
      const c = r.perPlatform[p];
      if (!c) continue;
      sum.breaks += c.breaks;
      sum.undocumented += c.undocumented;
      sum.caveats += c.caveats;
      sum.guarded += c.guarded;
      sum.shellBreaks += c.shellBreaks;
    }
    perPlatform[p] = sum;
  }
  const all = reports.flatMap((r) => r.findings);
  return {
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    databaseRecordedAt: engine.db.generated_at,
    platforms: opts.platforms,
    files: reports,
    totals: {
      filesChecked: reports.length,
      commands: reports.reduce((n, r) => n + r.commands, 0),
      flags: reports.reduce((n, r) => n + r.flags, 0),
      errors: all.filter((f) => f.severity === "error").length,
      warnings: all.filter((f) => f.severity === "warning").length,
      perPlatform
    }
  };
}
function platformLine(p, c) {
  const parts2 = [c.breaks ? `${c.breaks} will break` : "nothing breaks"];
  if (c.caveats) parts2.push(`${c.caveats} exist${c.caveats === 1 ? "s" : ""} but failed in use`);
  if (c.undocumented) parts2.push(`${c.undocumented} not documented there`);
  if (c.shellBreaks) parts2.push(`${c.shellBreaks} shell construct${c.shellBreaks === 1 ? "" : "s"} break`);
  if (c.guarded) parts2.push(`${c.guarded} guarded`);
  return `${PLATFORM_NAME2[p]}: ${parts2.join(" \xB7 ")}`;
}
var SITE = "https://barbarkaragul-oss.github.io/will-it-run-on-a-mac/";
var BADGE_MARKDOWN = `[![Will it run on a Mac?](https://img.shields.io/badge/will%20it%20run%20on%20a%20Mac%3F-checked%20in%20CI-2ea44f)](${SITE})`;

// src/cli.ts
var here = path.dirname(fileURLToPath(import.meta.url));
var SKIP = /* @__PURE__ */ new Set(["node_modules", ".git"]);
var HELP = `usage: will-it-run-on-a-mac [options] [file or directory ...]

Checks shell scripts for flags and shell constructs that break on macOS (BSD userland, bash 3.2, zsh) and
Alpine (BusyBox), against a database of what those platforms' own binaries did when every flag was run.
With no paths, every *.sh under the current directory is checked (node_modules and .git are skipped).

  --platforms <list>   macos,alpine (default), or include ubuntu
  --json               print the full report as JSON
  --verbose            also list what could not be checked ($OPTS, dynamic command names, unknown tools)
  --no-fail            exit 0 even when something breaks
  -h, --help           this text

Exit codes: 0 nothing breaks, 1 something breaks, 2 the check could not be run.
${SITE}`;
function walk(dir, out2) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out2);
    else if (e.isFile() && e.name.endsWith(".sh")) out2.push(p);
  }
}
function label(f) {
  if (f.severity === "error") return "breaks ";
  if (f.severity === "warning") return "warning";
  return "note   ";
}
async function main(argv) {
  let platforms = "macos,alpine", json = false, verbose = false, fail = true;
  const paths = [];
  for (let i2 = 0; i2 < argv.length; i2++) {
    const a = argv[i2];
    if (a === "-h" || a === "--help") {
      console.log(HELP);
      return 0;
    } else if (a === "--json") json = true;
    else if (a === "--verbose") verbose = true;
    else if (a === "--no-fail") fail = false;
    else if (a === "--platforms") {
      const v = argv[++i2];
      if (!v) throw new Error("--platforms needs a value");
      platforms = v;
    } else if (a.startsWith("--platforms=")) platforms = a.slice("--platforms=".length);
    else if (a.startsWith("-")) throw new Error(`unknown option ${a} (see --help)`);
    else paths.push(a);
  }
  const chosen = parsePlatforms(platforms);
  const files = [];
  if (paths.length === 0) walk(".", files);
  for (const p of paths) {
    if (!existsSync2(p)) throw new Error(`no such file or directory: ${p}`);
    if (statSync(p).isDirectory()) walk(p, files);
    else files.push(p);
  }
  if (files.length === 0) {
    console.error("no shell scripts found (looked for *.sh)");
    return 0;
  }
  const engine = await loadEngine({
    treeSitterWasm: path.join(here, "vendor", "web-tree-sitter.wasm"),
    bashWasm: path.join(here, "vendor", "tree-sitter-bash.wasm"),
    flagsJson: path.join(here, "..", "data", "flags.json"),
    shellsJson: path.join(here, "..", "data", "shells.json")
  });
  const report = checkFiles(
    files.sort().map((f) => ({ path: f.split(path.sep).join("/").replace(/^\.\//, ""), src: readFileSync2(f, "utf8") })),
    engine,
    { platforms: chosen, verbose }
  );
  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    for (const fr of report.files) {
      const shown = fr.findings.filter((f) => verbose || f.severity !== "notice");
      console.log(`${fr.file} \xB7 ${fr.commands} command${fr.commands === 1 ? "" : "s"}, ${fr.flags} flag${fr.flags === 1 ? "" : "s"}${fr.interp ? ` \xB7 ${fr.interp} script` : ""}${shown.length ? "" : " \xB7 nothing breaks"}`);
      for (const f of shown) {
        const what = f.flag ? `${f.subject} ${f.flag}` : f.subject;
        console.log(`  ${label(f)}  line ${f.line}  ${what}${f.platform ? `  (${PLATFORM_NAME2[f.platform]})` : ""}`);
        console.log(`           ${f.message}`);
      }
    }
    console.log("");
    for (const p of report.platforms) console.log(platformLine(p, report.totals.perPlatform[p]));
    console.log(`database recorded ${report.databaseRecordedAt.slice(0, 10)} \xB7 full evidence: ${SITE}`);
  }
  return fail && report.totals.errors > 0 ? 1 : 0;
}
main(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
}, (e) => {
  console.error(`will-it-run-on-a-mac: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 2;
});
