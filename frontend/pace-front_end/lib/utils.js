import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const url = "http://localhost:8080/api";

async function fetchAPI(path, method, body) {
  const options = {
    method: method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(url + path, options);
    return await res.json();
  } catch (err) {
    console.error("Fetch error:", err);
    return null;
  }
}

export default fetchAPI;
