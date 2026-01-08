export interface PrefabCollectionJSON {
    prefabs: PrefabJSON[]
}

export interface PrefabJSON {
    schema: string
    version: number
    meta: {
        name: string
        created: string
    }
    mounts: PrefabMountJSON[]
    root: PrefabNodeJSON
}

export interface PrefabMountJSON {
    alias: string
    path: string
}

export interface TransformComponentJSON {
    type: "transform"
    position: number[]
    rotation: number[]
    scale: number[]
    [key: string]: unknown
}

export interface PrefabComponentJSON {
    type: string
    [key: string]: unknown
}

export interface PrefabNodeJSON {
    name: string
    components?: PrefabComponentJSON[]
    children?: PrefabNodeJSON[]
}

export function isTransformComponent(c: PrefabComponentJSON): c is TransformComponentJSON {
    return c.type === "transform"
}

