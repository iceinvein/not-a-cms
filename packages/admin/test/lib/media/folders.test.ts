import { describe, expect, test } from "bun:test"
import {
  buildFolderTree,
  filterByFolder,
  folderDescendantIds,
  folderPath,
} from "../../../src/lib/media/folders"

const folders = [
  { id: "a", name: "Brand", parentId: null },
  { id: "b", name: "Logos", parentId: "a" },
  { id: "c", name: "Campaigns", parentId: null },
]
const items = [
  {
    id: "1",
    filename: "x",
    mimetype: "image/png",
    size: 1,
    uploadedAt: "",
    url: "",
    folderId: "b",
  },
  { id: "2", filename: "y", mimetype: "image/png", size: 1, uploadedAt: "", url: "" },
]

describe("buildFolderTree", () => {
  test("nests by parentId, name-sorted at each level", () => {
    const tree = buildFolderTree(folders as any)
    expect(tree.map((node) => node.name)).toEqual(["Brand", "Campaigns"])
    expect(tree[0].children.map((node) => node.name)).toEqual(["Logos"])
  })
})

describe("buildFolderTree ordering by position", () => {
  test("orders siblings by position, then name", () => {
    const f = [
      { id: "a", name: "Zeta", parentId: null, position: 0 },
      { id: "b", name: "Alpha", parentId: null, position: 1 },
      { id: "c", name: "Mid", parentId: null }, // no position -> treated as 0, ties break by name
    ]
    expect(buildFolderTree(f as any).map((n) => n.name)).toEqual(["Mid", "Zeta", "Alpha"])
  })
})

describe("folderDescendantIds", () => {
  test("returns the folder plus all transitive descendants", () => {
    const f = [
      { id: "a", name: "A", parentId: null },
      { id: "b", name: "B", parentId: "a" },
      { id: "c", name: "C", parentId: "b" },
      { id: "d", name: "D", parentId: null },
    ]
    expect([...folderDescendantIds(f as any, "a")].sort()).toEqual(["a", "b", "c"])
    expect([...folderDescendantIds(f as any, "d")]).toEqual(["d"])
  })
})

describe("folderPath", () => {
  test("returns root..id", () => {
    expect(folderPath(folders as any, "b").map((folder) => folder.name)).toEqual(["Brand", "Logos"])
  })
})

describe("filterByFolder", () => {
  test("all / unsorted / by id", () => {
    expect(filterByFolder(items as any, "all")).toHaveLength(2)
    expect(filterByFolder(items as any, null).map((item) => item.id)).toEqual(["2"])
    expect(filterByFolder(items as any, "b").map((item) => item.id)).toEqual(["1"])
  })
})
