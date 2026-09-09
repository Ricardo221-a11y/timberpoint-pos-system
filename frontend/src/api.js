const API_BASE =
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000";

export const tk = () =>
  localStorage.getItem("token");

export async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const token = tk();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(
    `${API_BASE}${path}`,
    {
      ...options,
      headers,
    }
  );

  let data = {};

  try {
    data = await response.json();
  } catch {
    // Ignore JSON parse errors
  }

  if (!response.ok) {
    throw new Error(
      data.detail ||
      data.message ||
      "Request failed"
    );
  }

  return data;
}

export async function login(
  email,
  password
) {
  const result = await api(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
      }),
    }
  );

  localStorage.setItem(
    "token",
    result.access_token
  );

  return result;
}

export async function downloadBackup() {
  const response = await fetch(`${API_BASE}/api/backup/export`, {
    headers: { Authorization: `Bearer ${tk()}` },
  });
  if (!response.ok) throw new Error("Backup could not be created");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `timberpoint-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
