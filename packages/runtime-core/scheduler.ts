export interface SchedulerJob extends Function {
  id?: number
}

// ジョブ（関数）を保持する配列
// スケジュールされたジョブはこのキューに蓄積される
const queue: SchedulerJob[] = []

// キュー内の現在のインデックスを追跡するための変数
let flushIndex = 0

// キューが現在フラッシュ（ジョブの実行）されているかを示すフラグ
// ジョブの実行中に true となる
let isFlushing = false

// フラッシュが予約されているかを示すフラグ
// フラッシュがまだ開始されていないが、すでに予約されている場合に true となる
// 既にフラッシュが予約されている場合、再度予約しないようにするために使用される
let isFlushPending = false

// 解決済みの Promise オブジェクト
// 非同期処理をスケジュールするために使用される
const resolvedPromise = Promise.resolve() as Promise<any>

// ジョブをキューに追加する関数
export function queueJob(job: SchedulerJob) {
  if (
    // キューが空
    !queue.length ||
    // キュー内に同じジョブが含まれていない
    // - isFlushingでの分岐により、実行中のジョブの次に同じジョブが追加されることを防ぐ
    !queue.includes(job, isFlushing ? flushIndex + 1 : flushIndex)
  ) {
    //
    // ジョブをキューに追加
    //

    if (job.id == null) {
      // ジョブにIDがない場合、キューの末尾に追加
      queue.push(job)
    } else {
      // ジョブにIDがある場合、優先度を維持できる適切な位置に追加
      queue.splice(findInsertionIndex(job.id), 0, job)
    }

    //
    // 必要に応じて実行を予約
    //

    queueFlush()
  }
}

function queueFlush() {
  if (!isFlushing && !isFlushPending) {
    //
    // 現在実行中でなく、かつ実行が予約されていない場合にのみ、実行を予約
    //

    // 実行が予約された
    isFlushPending = true

    // 実行は非同期で行う
    resolvedPromise.then(() => {
      // 実行開始するので予約を解除
      isFlushPending = false
      // 実行が開始された
      isFlushing = true

      // キュー内の各ジョブを順番に実行
      queue.forEach((job) => {
        job()
      })

      // キュー内のジョブをすべて実行したので、キューをクリア
      flushIndex = 0
      queue.length = 0

      // 実行が終了した
      isFlushing = false
    })
  }
}

// ジョブの挿入位置を検索する関数
function findInsertionIndex(id: number) {
  // 現在実行中のジョブの次から、キューの末尾までを探索
  let start = flushIndex + 1
  let end = queue.length

  // 二分探索による挿入位置の決定
  while (start < end) {
    // 現在の検索範囲の中間位置を計算
    // >>> はゼロ埋め右シフト演算子で、小数点以下を切り捨てる
    const middle = (start + end) >>> 1

    // 中間位置にあるジョブのIDを取得
    const middleJobId = getId(queue[middle])

    // middleJobId が挿入したい id より小さい場合、start を更新
    // そうでない場合、end を更新
    middleJobId < id ? (start = middle + 1) : (end = middle)
  }

  // 最終的に start が挿入すべき位置となる
  return start
}

// ジョブの ID を取得する関数
// - IDがないジョブは優先度を最低とみなし、ソート時に後回しにしたい
// -> Infinity を返すことで、IDを持つどのジョブよりも大きな値となり、挿入位置がキューの末尾になる
const getId = (job: SchedulerJob): number =>
  job.id == null ? Infinity : job.id
