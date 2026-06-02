import { describe, expect, test } from "bun:test"
import { buildFolderTree, filterByFolder, folderPath } from "../../../src/lib/media/folders"

const folders = [
  { id: "a", name: "Brand", parentId: null },
  { id: "b", name: "Logos", parentId: "a" },
  { id: "c", name: "Campaigns", parentId: null },
]
const items = [
  { id: "1", filename: "x", mimetype: "image/png", size: 1, uploadedAt: "", url: "", folderId: "b" },
  { id: "2", filename: "y", mimetype: "image/png", size: 1, uploadedAt: "", url: "" },
]

describe("buildFolderTree", () => {
  test("nests by parentId, name-sorted at each level", () => {
    const tree = buildFolderTree(folders as any)
    expect(tree.map((node) => node.name)).toEqual(["Brand", "Campaigns"])
    expect(tree[0].children.map((node) => node.name)).toEqual(["Logos"])
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
