import axios from "axios";

async function main() {
  const unauthenticatedAxios = axios.create({
    baseURL: "http://localhost:3333",
  });

  // initial setup for authenticated users
}

main();
