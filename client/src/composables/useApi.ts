import { ref } from "vue";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3333/api";

export function useApi() {
  const loading = ref(false);
  const error = ref("");

  async function get<T>(endpoint: string, params?: Record<string, string>): Promise<T | null> {
    loading.value = true;
    error.value = "";
    try {
      const url = new URL(endpoint, API_BASE);
      if (params) {
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      }
      const res = await fetch(url.toString());
      if (!res.ok) {
        error.value = `请求失败 (${res.status})`;
        return null;
      }
      return await res.json();
    } catch (e) {
      error.value = "网络请求失败，请确认后端服务是否已启动";
      return null;
    } finally {
      loading.value = false;
    }
  }

  function clearError() {
    error.value = "";
  }

  return { API_BASE, loading, error, get, clearError };
}
