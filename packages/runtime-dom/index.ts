//
// nodeOps と renderer のファクトリをもとに renderer を完成させる
//

import { createRenderer } from '../runtime-core'
import { nodeOps } from './nodeOps'

const { render } = createRenderer(nodeOps)
