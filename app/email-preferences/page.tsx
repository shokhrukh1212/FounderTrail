import type { Metadata } from "next";
import { EmailPreferences } from "@/components/EmailPreferences";
export const metadata:Metadata={title:"Email preferences",robots:{index:false,follow:false}};
export default function EmailPreferencesPage(){return <main className="app-shell inner-page"><EmailPreferences/></main>}
