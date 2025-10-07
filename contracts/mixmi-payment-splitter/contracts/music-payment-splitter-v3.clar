;; Music Payment Splitter Contract v3
;; Splits payments between composition (idea) and sound recording (implementation) rights holders
;; Each category gets 50% of the purchase price, then distributes to contributors by their percentages
;; V3: Fixed to properly receive STX payment from caller before distributing

;; Define constants
(define-constant contract-owner tx-sender)
(define-constant err-unauthorized (err u100))
(define-constant err-invalid-amount (err u101))
(define-constant err-transfer-failed (err u102))
(define-constant err-invalid-percentage (err u103))
(define-constant err-empty-splits (err u104))

;; Main function: Split payment for a single track purchase
;; Takes composition splits and sound recording splits
;; Each split is {wallet: principal, percentage: uint} where percentage is 0-100
;; Supports up to 50 contributors per category for batch cart payments
(define-public (split-track-payment
  (total-price uint)
  (composition-splits (list 50 {wallet: principal, percentage: uint}))
  (recording-splits (list 50 {wallet: principal, percentage: uint})))

  (let
    (
      ;; Calculate 50% for each category
      (composition-pool (/ total-price u2))
      (recording-pool (/ total-price u2))
      (buyer tx-sender)
    )

    (begin
      ;; Validate inputs
      (asserts! (> total-price u0) err-invalid-amount)
      (asserts! (> (len composition-splits) u0) err-empty-splits)
      (asserts! (> (len recording-splits) u0) err-empty-splits)

      ;; Validate percentages sum to 100
      (asserts! (unwrap! (validate-percentages composition-splits) err-invalid-percentage) err-invalid-percentage)
      (asserts! (unwrap! (validate-percentages recording-splits) err-invalid-percentage) err-invalid-percentage)

      ;; First, receive the full payment from the buyer into the contract
      (try! (stx-transfer? total-price buyer (as-contract tx-sender)))

      ;; Then distribute composition payments (50% of price)
      (try! (distribute-splits composition-pool composition-splits))

      ;; Then distribute sound recording payments (50% of price)
      (try! (distribute-splits recording-pool recording-splits))

      (ok true)
    )
  )
)

;; Helper function: Distribute a pool of STX according to percentage splits
;; Note: Due to integer division, small amounts of "dust" (< 0.01 STX) may be lost
;; This is acceptable and standard practice in blockchain payment splitting
(define-private (distribute-splits
  (pool-amount uint)
  (splits (list 50 {wallet: principal, percentage: uint})))

  (get result (fold process-split-item splits {pool: pool-amount, result: (ok true)}))
)

;; Helper: Process a single split item
;; Now transfers FROM the contract TO the recipient
(define-private (process-split-item
  (split {wallet: principal, percentage: uint})
  (state {pool: uint, result: (response bool uint)}))

  (let
    (
      (amount (/ (* (get pool state) (get percentage split)) u100))
    )
    (if (> amount u0)
      {
        pool: (get pool state),
        result: (as-contract (stx-transfer? amount tx-sender (get wallet split)))
      }
      state
    )
  )
)

;; Read-only function: Get composition pool amount
(define-read-only (get-composition-pool (total-price uint))
  (ok (/ total-price u2))
)

;; Read-only function: Get recording pool amount
(define-read-only (get-recording-pool (total-price uint))
  (ok (/ total-price u2))
)

;; Read-only function: Calculate individual payment amount
(define-read-only (calculate-payment (pool-amount uint) (percentage uint))
  (ok (/ (* pool-amount percentage) u100))
)

;; Read-only function: Validate that percentages add up to 100
(define-read-only (validate-percentages (splits (list 50 {wallet: principal, percentage: uint})))
  (let
    (
      (total (fold sum-percentages splits u0))
    )
    (ok (is-eq total u100))
  )
)

;; Helper to sum percentages
(define-private (sum-percentages (split {wallet: principal, percentage: uint}) (sum uint))
  (+ (get percentage split) sum)
)
