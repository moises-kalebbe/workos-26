type AuthSnapshot = {
  userId: string | null;
  getToken: () => Promise<string | null>;
};

let snapshot: AuthSnapshot = {
  userId: null,
  getToken: async () => null,
};

export function setClerkBridge(next: AuthSnapshot) {
  snapshot = next;
}

export function clearClerkBridge() {
  snapshot = {
    userId: null,
    getToken: async () => null,
  };
}

export function getClerkUserId() {
  return snapshot.userId;
}

export async function getClerkToken() {
  return snapshot.getToken();
}
