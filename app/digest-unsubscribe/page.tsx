import type { Metadata } from "next";
import { DigestUnsubscribe } from "@/components/DigestUnsubscribe";
export const metadata:Metadata={title:"Unsubscribe from digest",robots:{index:false,follow:false}};
export default async function DigestUnsubscribePage({searchParams}:{searchParams:Promise<{token?:string}>}){const{token}=await searchParams;return <main className="app-shell inner-page account-page"><header className="page-heading"><p className="eyebrow">Email preference</p><h1>Weekly digest</h1></header><section className="settings-card"><DigestUnsubscribe token={token??""}/></section></main>}
