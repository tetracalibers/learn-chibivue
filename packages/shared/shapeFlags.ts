//
// 1 << n はビットシフト演算で、1 を左に n ビットシフトすることを意味する
// これにより、ビットが一つだけ立った（1 の位置が一箇所だけの）値が得られる
//

export const enum ShapeFlags {
  ELEMENT = 1, // 0001
  COMPONENT = 1 << 2, // 0010
  TEXT_CHILDREN = 1 << 3, // 0100
  ARRAY_CHILDREN = 1 << 4, // 1000
}
