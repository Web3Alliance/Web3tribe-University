declare global {
  interface Window {
    Pi: any
  }
}

export const initPi = () => {
  if (typeof window !== "undefined" && window.Pi) {
    window.Pi.init({ version: "2.0", sandbox: true })
  }
}

export const authenticatePi = async () => {
  const scopes = ["payments", "username"]
  return await window.Pi.authenticate(scopes, onIncompletePaymentFound)
}

const onIncompletePaymentFound = (payment: any) => {
  console.log("Incomplete payment found", payment)
}

export const createPiPayment = async (amount: number, memo: string, metadata: object) => {
  return await window.Pi.createPayment({
    amount,
    memo,
    metadata
  }, {
    onReadyForServerApproval: (paymentId: string) => {
      console.log("Ready for approval", paymentId)
    },
    onReadyForServerCompletion: (paymentId: string, txid: string) => {
      console.log("Ready for completion", paymentId, txid)
    },
    onCancel: (paymentId: string) => {
      console.log("Payment cancelled", paymentId)
    },
    onError: (error: any) => {
      console.log("Payment error", error)
    }
  })
}