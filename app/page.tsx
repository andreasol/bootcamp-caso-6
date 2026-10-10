import { redirect } from "next/navigation";

// Every role lands on the queue; proxy.ts already sent anonymous visitors to /login.
export default function Home() {
  redirect("/queue");
}
