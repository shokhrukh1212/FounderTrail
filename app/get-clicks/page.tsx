import { redirect } from "next/navigation";
export default function GetClicksRedirect() { redirect("/?view=discover#products"); }
