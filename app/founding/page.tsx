import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ProductRow } from "@/components/ProductRow";
import { BIDINDEX_VISITOR_COOKIE } from "@/lib/bidindex-visitor";
import { getActiveVoteSlugs,getFoundingProducts } from "@/lib/product-data";
import { eventHash } from "@/lib/request-security";
export const metadata:Metadata={title:"Founding products",description:"Discover the first products building the bidding-product ecosystem."};export const dynamic="force-dynamic";
export default async function FoundingPage(){const products=await getFoundingProducts();const store=await cookies();const id=store.get(BIDINDEX_VISITOR_COOKIE)?.value??store.get("yourhour_visitor")?.value??null;const voted=await getActiveVoteSlugs(id?eventHash("bidindex:visitor",id):null);return <main className="app-shell inner-page"><header className="page-heading"><p className="eyebrow">The beginning</p><h1>Founding products are live</h1><p>Discover the first products building the bidding-product ecosystem.</p></header><div className="product-list">{products.map((product,index)=><ProductRow key={product.id} product={product} position={index+1} voted={voted.has(product.slug)}/>)}</div></main>}
