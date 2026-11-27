// Legal documents – ENGLISH VERSION (draft 3). Same content as the Czech version (src/legal/cs.mjs).
// ⚖️ LEVEL 3 – changes only with the owner's approval.
import { SITE, OPERATOR, INDEPENDENCE, SERVICES_OFFERED as SVC } from '../site.mjs';
import { head, toc, email, seller, vatText, returnAddress, coi, ecc, tradeOffice, registerText, LEGAL_VERSION } from './common.mjs';
import { TERMS as T, priceEn } from '../terms.mjs';

export const warrantyShortEn = () => `quality warranty of up to ${T.warrantyMonths} months${T.inspection.enabled ? ' (second year after a warranty inspection)' : ''}`;
const insp = T.inspection;

const L = 'en';
const doc = (key, path, title, description, body) => ({ key, lang: L, path, title, description, body });

export const terms = doc('terms', '/en/terms', 'General Terms and Conditions',
  'General terms and conditions of the Atelier Dante Time online shop for finished mechanical watches in the Czech Republic and the EU.',
  () => `${head(L)}
${toc(L, [['t1', 'Introduction'], ['t2', 'Watches, components and materials'], ['t3', 'Prices and currencies'], ['t4', 'Order and conclusion of the contract'], ['t5', 'Payment'], ['t6', 'Delivery'], ['t7', 'Warranty and statutory rights'], ['t8', 'Lifetime authenticity guarantee'], ['t9', 'Withdrawal from the contract'], ['t10', 'Sales to EU countries'], ['t11', 'Personal data and cookies'], ['t12', 'Complaints, dispute resolution and supervision'], ['t13', 'Business customers'], ['t14', 'Final provisions']])}
<h2 id="t1">1. Introduction</h2>
<ol>
<li>These general terms and conditions (the “Terms”) govern the sale of finished mechanical watches through the online shop at <strong>${SITE.origin.replace('https://', '')}</strong> (the “Shop”).</li>
<li>The seller is ${seller(L)}, e-mail ${email} (the “Seller” or the “Atelier”).</li>
<li>The buyer is a consumer or a business concluding a purchase contract with the Seller (the “Buyer”). A consumer is a natural person acting outside their trade, business or profession (Section 419 of Act No. 89/2012 Coll., the Czech Civil Code, the “Civil Code”).</li>
<li>${INDEPENDENCE.en}</li>
<li>The following form part of these Terms: <a href="/en/complaints">Complaints Procedure</a>, <a href="/en/withdrawal">Withdrawal and Returns</a> (including the model form), <a href="/en/warranty">Warranty and Lifetime Authenticity Guarantee</a>, <a href="/en/shipping-payment">Shipping and Payment</a> and <a href="/en/eu-sales">Sales to EU Countries</a>.${SVC ? ' Service, restoration, rebuilds and custom work are governed by the <a href="/en/custom-work">Custom Work and Service Terms</a>.' : ''}</li>
<li>The contract may be concluded in Czech or English. Both language versions of these Terms have the same content.</li>
</ol>
<h2 id="t2">2. Watches, components and materials</h2>
<ol>
<li>The Shop offers finished mechanical watches of the following types, stated for each piece: <strong>Original watches</strong> (pre-owned vintage watches serviced or restored in the Atelier), <strong>Dante Time Atelier Rebuilds</strong> (watches modified in the Atelier in which some components were replaced with new ones) and <strong>Atelier builds</strong> (watches assembled in the Atelier from selected components).</li>
<li>For each piece the Seller clearly distinguishes the <strong>original components</strong> from the <strong>new components used in the Dante Time rebuild</strong> or otherwise replaced parts. The description of condition, work carried out and components forms part of the contract.</li>
<li>Each watch is a <strong>unique piece</strong> available only once. The presentation in the Shop is informative and is not an offer to conclude a contract.</li>
<li><strong>Precious metals.</strong> Cases made of gold, silver or platinum are offered only with the stated fineness and a valid hallmark under Czech Act No. 539/1992 Coll. on hallmarking. The sales document states the type of precious metal, its fineness and weight.</li>
<li><strong>Gold-plated</strong> (or silver-plated) cases are not made of precious metal and are always expressly labelled as such.</li>
</ol>
<h2 id="t3">3. Prices and currencies</h2>
<ol>
<li>Watch prices are set in Czech crowns (CZK) and are final. ${vatText(L)}</li>
<li>The Buyer may pay in CZK or in euros (EUR). For payment in EUR the total price is converted at the Atelier’s rate valid at the time of the order and rounded up to a whole euro. The EUR amount is shown before the order is placed and in the order confirmation.</li>
<li>The shipping price and any cash-on-delivery fee are shown for the selected country and shipping method <strong>before the order is placed</strong>, so the Buyer always knows the final price.</li>
<li>The Seller does not use personalised pricing based on automated decision-making. Should it show a discount, it will also show the lowest price of the previous 30 days.</li>
</ol>
<h2 id="t4">4. Order and conclusion of the contract</h2>
<ol>
<li>The Buyer adds watches to the cart, selects the delivery country, currency, shipping and payment, and fills in their details. Everything can be checked and corrected before sending.</li>
<li>The order is sent with the button <strong>“Order with obligation to pay”</strong> after agreeing to these Terms.</li>
<li>After the order is sent, the Shop <strong>reserves</strong> the watches so nobody else can buy them at the same time: until the payment due date, or until dispatch for cash on delivery.</li>
<li>The contract is concluded when the Seller delivers the e-mail <strong>order confirmation</strong>, which includes these Terms and the withdrawal information valid on the day of the order.</li>
<li>The Seller archives the contract electronically and makes it available to the Buyer on request. It is not accessible to third parties.</li>
<li>If the watch cannot be delivered (e.g. it was demonstrably damaged before dispatch), the Seller informs the Buyer without undue delay and refunds any payment within ${T.refundDays} days.</li>
</ol>
<h2 id="t5">5. Payment</h2>
<ol>
<li>Payment methods: <strong>bank transfer in advance</strong> (CZK with Czech QR payment, EUR with SEPA QR code), <strong>cash on delivery</strong> (Czech pickup points only) and, once the payment gateway is activated, <strong>card payment</strong>. International orders are paid in advance.</li>
<li>Bank transfers are due within <strong>${T.paymentDueDays} days</strong> of the conclusion of the contract to the account ${OPERATOR.bankAccount} (IBAN ${OPERATOR.ibanPretty}, BIC ${OPERATOR.bic}, account holder ${OPERATOR.accountHolder}) with the reference given in the order confirmation.</li>
<li>If the price is not paid by the due date, the reservation ends and the Seller may withdraw from the contract; the Buyer is informed by e-mail.</li>
<li>For cash on delivery the price is payable on collection of the parcel.</li>
<li>Ownership passes to the Buyer upon full payment and receipt of the watch. The Seller sends the sales document (invoice) electronically after payment; it contains the watch identification, which is also used for the authenticity guarantee.</li>
</ol>
<h2 id="t6">6. Delivery</h2>
<ol>
<li>The Seller delivers to all member states of the European Union. Methods and prices are listed under <a href="/en/shipping-payment">Shipping and Payment</a>.</li>
<li>Available watches are dispatched within <strong>${T.dispatchWorkingDays} working days</strong> of receipt of payment, or of order confirmation for cash on delivery, and in any case within 30 days of the conclusion of the contract unless agreed otherwise.</li>
<li>Higher-value watches are sent only by <strong>insured shipment</strong> corresponding to their value, or handed over in person by prior individual arrangement. The Seller has no retail shop.</li>
<li>For consumers, the risk of damage passes upon receipt of the watch.</li>
<li>If the Buyer fails to collect a cash-on-delivery parcel without good reason, the Seller may withdraw from the contract and claim the <strong>actual costs</strong> of sending and returning the parcel as damages. The Seller charges no contractual penalty.</li>
<li>Please check the parcel on receipt. See <a href="/en/withdrawal#damage">Withdrawal and Returns</a> for damaged parcels.</li>
</ol>
<h2 id="t7">7. Warranty and statutory rights</h2>
<ol>
<li>For the watches sold, the Seller provides a voluntary <strong>quality warranty of up to ${T.warrantyMonths} months</strong>${insp.enabled ? '. It continues in the second year on condition that the watch undergoes a warranty inspection' : ''}. Full conditions are set out in <a href="/en/warranty">Warranty and Authenticity Guarantee</a>. The consumer’s statutory rights for defects are not affected. The procedure is set out in the <a href="/en/complaints">Complaints Procedure</a>.</li>
</ol>
<h2 id="t8">8. Lifetime authenticity guarantee</h2>
<p>The Seller provides a lifetime authenticity guarantee on <strong>movements, dials and hands declared as original</strong>, also for every subsequent owner of the watch. Conditions: <a href="/en/warranty">Warranty and Authenticity Guarantee</a>. The guarantee does not limit the Buyer’s statutory rights.</p>
<h2 id="t9">9. Withdrawal from the contract</h2>
<ol>
<li>A consumer may withdraw from a distance contract for finished watches <strong>without giving a reason within ${T.withdrawalDays} days</strong> of receipt. Procedure, model form and the “Withdraw from contract” function: <a href="/en/withdrawal">Withdrawal and Returns</a>.</li>
<li>There is no right of withdrawal for watches made or modified <strong>to the consumer’s specification</strong> (Section 1837(d) of the Civil Code). Rebuilds and builds offered in the Shop as finished pieces may be returned.</li>
</ol>
<h2 id="t10">10. Sales to EU countries</h2>
<p>Customers from all EU states are offered the same prices and conditions. Cross-border rules (law, language, shipping, returns from abroad): <a href="/en/eu-sales">Sales to EU Countries</a>.</p>
<h2 id="t11">11. Personal data and cookies</h2>
<p>See the <a href="/en/privacy">Privacy Policy</a> and the <a href="/en/cookies">Cookie Policy</a>.</p>
<h2 id="t12">12. Complaints, dispute resolution and supervision</h2>
<ol>
<li>Complaints are handled at ${email}.</li>
<li>Consumers have the right to out-of-court dispute resolution. The competent body is the ${coi(L)}. See <a href="/en/dispute-resolution">Dispute Resolution</a>.</li>
<li>Supervisory authorities: Czech Trade Inspection Authority (consumer protection), ${tradeOffice(L)} (trade licensing), Office for Personal Data Protection and the Czech Assay Office (precious metal articles).</li>
<li>The Seller does not publish customer reviews. Should it start doing so, it will state whether and how it verifies their origin.</li>
</ol>
<h2 id="t13">13. Business customers</h2>
<p>Consumer protection provisions do not apply to business Buyers, except for the contractual ${T.withdrawalDays}-day return of finished watches, which the Seller grants on the same terms as to consumers. The risk passes on handover to the first carrier. The warranty under Article 7, including the warranty inspection condition, also applies to businesses.</p>
<h2 id="t14">14. Final provisions</h2>
<ol>
<li>The contract is governed by Czech law. For consumers habitually resident in another EU member state this does not affect the mandatory consumer protection rules of that state (Article 6 of the Rome I Regulation).</li>
<li>The Seller may amend these Terms; concluded contracts are governed by the version valid on the day the order was sent.</li>
<li>Version ${LEGAL_VERSION}.</li>
</ol>`);

export const claims = doc('claims', '/en/complaints', 'Complaints Procedure',
  'Atelier Dante Time complaints procedure: quality warranty, deadlines and how to make a claim.',
  () => `${head(L)}
<h2>1. Scope</h2>
<ul><li><strong>finished watches</strong> bought from the Seller (purchase contract),</li>${SVC ? '<li><strong>custom builds</strong> assembled from the Atelier’s parts to the customer’s specification,</li><li><strong>service, restoration and rebuilds</strong> of the customer’s watch (contract for work) – the work done and newly supplied components.</li>' : ''}</ul>
<p>Operator: ${seller(L)}, e-mail ${email}.</p>
<h2>2. Warranty period and liability for defects</h2>
<ol><li>We provide a voluntary <strong>quality warranty of up to ${T.warrantyMonths} months</strong>${insp.enabled ? '. It continues in the second year on condition that the watch undergoes a warranty inspection' : ''}. Full conditions are set out in <a href="/en/warranty">Warranty and Authenticity Guarantee</a>. The consumer’s statutory rights for defects are not affected.</li>${SVC ? `<li>For service, restoration and rebuilds we are liable for the work done and new components for ${T.liabilityMonths} months from handover.</li>` : ''}</ol>
<h2>3. What is not a defect</h2>
<ul><li>condition and features stated in the description (patina, signs of use, replaced or new components) and defects for which a lower price was agreed,</li><li>for pre-owned watches, wear corresponding to the degree of use at receipt,</li><li>normal wear (strap, crystal, case surface, gradual wear of gold plating),</li><li>a rate deviation within the indicative tolerance of <strong>${T.accuracyVintage.replace(' s/den', ' seconds per day')}</strong> for vintage mechanical watches, depending on the calibre, technical condition and age (a different tolerance stated for a piece prevails),</li><li>damage caused by drops, impacts, water or moisture (unless expressly water-resistant), magnetism, chemicals or improper intervention by third parties,</li><li>damage resulting from not following the <a href="/en/care">watch care recommendations</a>.</li></ul>
<h2>4. How to make a claim</h2>
<ol><li>E-mail ${email} with the subject “Complaint”: order or job number, description of the defect, when it appears, photos or video and the right you are claiming.</li><li>Send the watch insured to ${returnAddress(L)}, not cash on delivery, after agreeing with us.</li><li>We confirm receipt of the claim by e-mail (date, content, requested remedy).</li></ol>
<h2>5. Your rights</h2>
<ol><li>You may request <strong>repair</strong> or replacement. As our watches are unique, defects are usually remedied by repair unless agreed otherwise.</li><li>You may request a reasonable <strong>price reduction</strong> or <strong>withdraw</strong> if we refused or failed to remedy the defect in accordance with the law, the defect recurs, it is a material breach, or it is clear we will not remedy it within a reasonable time or without significant inconvenience to you. You cannot withdraw for an insignificant defect.</li></ol>
<h2>6. Handling and costs</h2>
<ol><li>We handle the claim and remedy the defect <strong>within ${T.claimDays} days</strong> of the claim.</li><li><strong>Historic watches and original parts.</strong> We work with historic mechanical watches (for example PRIM, OMEGA or ROLEX). Original spare parts for them can be rare, and some have to be sourced and ordered from abroad. We do not compromise on the quality of the repair, so we prefer original parts. If the repair cannot be completed within this period, <strong>we inform you without undue delay</strong>, explain why and propose a reasonably longer period.</li><li>A longer period applies <strong>only by mutual agreement</strong>, which we confirm with you by e-mail. We never extend it unilaterally or automatically. If you do not agree to an extension, the ${T.claimDays}-day period applies; if we do not handle the claim in time, you have the same rights as for a material breach of contract (in particular the right to withdraw from the contract or to a reasonable price reduction).</li><li>We inform you by e-mail and confirm the date and method of handling, or explain a rejection.</li><li>For justified claims we reimburse reasonably incurred costs (in particular postage) and return the repaired watch at our cost.</li></ol>
<p>Out-of-court dispute resolution: <a href="/en/dispute-resolution">Dispute Resolution</a>.</p>`);

export const withdrawal = doc('withdrawal', '/en/withdrawal', 'Withdrawal and Returns',
  'How to return finished watches within 14 days: procedure, model withdrawal form and online withdrawal function.',
  () => `${head(L)}
<p class="notice"><strong>You can also withdraw online</strong> on the <a href="/odstoupeni">Withdraw from contract</a> page, or by e-mail to ${email}.</p>
<h2>1. ${T.withdrawalDays}-day period</h2>
<p>As a consumer you may withdraw from a distance contract for <strong>finished watches without giving a reason within ${T.withdrawalDays} days</strong> of receipt. It is sufficient to send the withdrawal before the period expires. We grant the same option contractually to business purchases.</p>
<h2>2. How to withdraw</h2>
<ul><li>online using the <a href="/odstoupeni">“Withdraw from contract”</a> function (we confirm receipt by e-mail),</li><li>by e-mail to ${email},</li><li>by letter to ${returnAddress(L)}.</li></ul>
<p>You may use the <a href="#form">model form</a>, but you do not have to.</p>
<h2>3. Returning the watch</h2>
<ol><li>Send the watch within ${T.withdrawalDays} days of withdrawal to ${returnAddress(L)}, insured and not cash on delivery. Personal handover is possible by prior arrangement.</li><li><strong>You bear the cost of returning the watch</strong>; returns from abroad may cost more.</li><li>You are liable for any diminished value resulting from handling beyond what is necessary to establish the nature and functioning of the watch (e.g. opening the case, scratches, water ingress).</li></ol>
<h2>4. Refund</h2>
<ol><li>We refund all payments received, including delivery costs (up to the cheapest delivery method offered), within ${T.refundDays} days of withdrawal, in the same currency and by the same means used, unless agreed otherwise.</li><li>We may withhold the refund until we receive the watch or proof that it has been sent.</li></ol>
<h2>5. When withdrawal is not possible</h2>
<ul><li><strong>custom builds and rebuilds made to your specification</strong> (Section 1837(d) of the Civil Code). Rebuilds and builds sold in the Shop as finished pieces can be returned${SVC ? ',' : '.'}</li>${SVC ? '<li><strong>service and restoration</strong> fully completed with your express consent before the withdrawal period expired. See <a href="/en/custom-work">Custom Work and Service</a>.</li>' : ''}</ul>
<h2 id="damage">6. Damaged parcel</h2>
<p>Record visible damage with the carrier or refuse the parcel, take photos and write to us within 2 working days. A later claim does not affect your statutory rights.</p>
<h2 id="form">7. Model withdrawal form</h2>
<p class="doc-meta">Annex to Czech Government Regulation No. 363/2013 Coll. (implementing Directive 2011/83/EU). Complete and return this form only if you wish to withdraw from the contract.</p>
<div class="card" style="box-shadow:none">
<p><strong>Notice of withdrawal</strong></p>
<p>To: ${OPERATOR.name} (${OPERATOR.tradeName}), ${OPERATOR.addressEn}, company ID ${OPERATOR.ico}, e-mail ${SITE.email}</p>
<p>I hereby give notice that I withdraw from my contract of sale of the following goods: ……………………………</p>
<p>Ordered on / received on: ……………………………</p>
<p>Order number: ……………………………</p>
<p>Name of consumer: ……………………………</p>
<p>Address of consumer: ……………………………</p>
<p>Account number / IBAN for the refund: ……………………………</p>
<p>Signature of consumer (only if this form is notified on paper): ……………………………</p>
<p>Date: ……………………………</p>
</div>`);

export const warranty = doc('warranty', '/en/warranty', 'Warranty and Lifetime Authenticity Guarantee',
  'Quality warranty of up to 24 months with a warranty inspection and a lifetime authenticity guarantee on original movements, dials and hands by Atelier Dante Time.',
  () => `${head(L)}
<h2>1. Quality warranty of up to ${T.warrantyMonths} months</h2>
<p><strong>By law you have the right to a free remedy from the seller for a defect that appears within ${T.liabilityMonths} months of receipt, including for pre-owned watches. A defect appearing within ${T.presumptionMonths} months is presumed to have existed at receipt. These rights are not affected in any way by the warranty or the warranty inspection.</strong></p>
<ol><li>In addition to your statutory rights, ${OPERATOR.name} (${OPERATOR.tradeName}) provides a voluntary <strong>quality warranty of up to ${T.warrantyMonths} months</strong> on the watches sold, from receipt (Section 2113 et seq. of the Civil Code). It covers the functioning of the movement and the work carried out.</li>${insp.enabled ? `<li><strong>Warranty inspection.</strong> In the first year the warranty applies without further conditions. In the second year the warranty continues if the watch undergoes a warranty inspection <strong>${insp.afterMonths} months after receipt</strong>, within ${insp.toleranceDays} days before or after that date. The inspection covers rate accuracy, amplitude, beat error and the basic technical condition of the watch; you receive a written report. The inspection costs <strong>${priceEn(insp.priceCzk)}</strong>. You pay for shipping the watch to the atelier and back unless agreed otherwise. Any defect covered by the warranty or by your statutory rights found during the inspection is remedied free of charge.</li><li>If the warranty inspection is not carried out, the voluntary warranty ends ${insp.afterMonths} months after receipt. Your statutory rights for defects continue in full.</li><li>The warranty inspection condition applies to watches purchased from the effective date of version ${insp.fromVersion} of these terms. It does not apply to watches purchased earlier.</li>` : ''}<li>The warranty does not cover: normal wear, straps and bracelets, crystals, wear of gold plating, a rate deviation within the indicative ${T.accuracyVintage.replace(' s/den', ' s/day')} tolerance for vintage watches (depending on calibre, condition and age), damage from drops, impacts, water, magnetism or improper intervention, and defects stated in the description.</li><li>The warranty is claimed in the same way as a defect, see the <a href="/en/complaints">Complaints Procedure</a>. You receive the warranty statement in text form with the order confirmation and again with the watch.</li></ol>
<h2>2. Lifetime authenticity guarantee</h2>
<p><strong>Guarantee statement (commercial guarantee under Section 2113 et seq. of the Civil Code)</strong></p>
<ol>
<li><strong>Guarantor:</strong> ${seller(L)}, e-mail ${email} (the “Atelier”).</li>
<li><strong>Scope:</strong> <strong>movements, dials and hands</strong> expressly <strong>declared as original</strong> for a specific watch in its description, order confirmation or invoice. The Atelier guarantees that these are original components of the respective watch manufacturer as described.</li>
<li><strong>Who benefits:</strong> the buyer and <strong>every subsequent owner</strong> of the watch.</li>
<li><strong>Duration:</strong> unlimited, for the entire life of the watch.</li>
<li><strong>Conditions:</strong> identification of the watch according to the Atelier’s records (e.g. case or movement number and photo documentation) and verification by the Atelier that the components concerned have not been replaced or modified after the sale by anyone other than the Atelier.</li>
<li><strong>Not covered:</strong> components not declared as original, new components used in the Dante Time rebuild, components replaced or modified after the sale by another person, normal wear and damage.</li>
<li><strong>How to claim:</strong> e-mail ${email} with the watch identification and the reason for doubt. The Atelier examines the watch, possibly with an independent expert. The Atelier bears the costs of examination and transport if the doubt is confirmed.</li>
<li><strong>Remedy for proven non-authenticity</strong>, at the entitled person’s choice: <strong>replacement</strong> with an original component at the Atelier’s cost if available, or a <strong>refund of the purchase price</strong> paid to the Atelier against return of the watch. If no original component is available, the purchase price is refunded.</li>
<li><strong>Statutory rights:</strong> the guarantee <strong>does not limit</strong> statutory rights for defects; consumers may always assert them instead.</li>
<li><strong>Independence:</strong> the authenticity guarantee applies regardless of the quality warranty and of warranty inspections.</li>
</ol>
${SVC ? `<h2>3. Customers’ watches (service, restoration, rebuilds)</h2>
<p>For jobs, the authenticity guarantee covers movements, dials and hands supplied by the Atelier and expressly declared as original in the work report. The Atelier does not verify the original components of a customer’s watch unless agreed.</p>` : ''}
<p class="doc-meta">${INDEPENDENCE.en}</p>`);

export const custom = doc('custom', '/en/custom-work', 'Custom Work, Service and Restoration',
  'Atelier Dante Time terms for custom builds, service, restoration and rebuilds of mechanical watches.',
  () => `${head(L)}
<h2>1. Types of jobs</h2>
<table><thead><tr><th>Type</th><th>What it is</th><th>Contract type</th></tr></thead><tbody>
<tr><td><strong>Service</strong></td><td>maintenance of the customer’s watch</td><td>contract for work (Section 2586 et seq. Civil Code)</td></tr>
<tr><td><strong>Restoration and repair</strong></td><td>repair and restoration of the customer’s watch</td><td>contract for work</td></tr>
<tr><td><strong>Rebuild</strong></td><td>modification of the customer’s watch to their specification</td><td>contract for work</td></tr>
<tr><td><strong>Custom build</strong></td><td>assembly of a watch from the Atelier’s parts to the customer’s specification</td><td>purchase contract for goods to be made</td></tr>
</tbody></table>
<p>Jobs are carried out by ${seller(L)} (the “Atelier”).</p>
<h2>2. Price and approval of work</h2>
<ol><li>The Atelier sends an offer with the scope of work, price and indicative timing. The contract is concluded by written (e-mail) acceptance.</li><li><strong>The customer must approve the price and any additional work in advance.</strong> The Atelier does not carry out work beyond the approved offer without consent.</li><li><strong>Confirming the offer makes the job binding</strong>, without prejudice to the consumer’s statutory rights (Article 6).</li><li><strong>A deposit is not required automatically.</strong> Where a specific job needs one (for example to buy parts), it is agreed individually, usually ${T.deposit.typical} of the agreed price. For specific or costly jobs a different amount may be agreed individually. The deposit is credited in full to the final price.</li><li>The amount and due date of any deposit and of the remaining price are stated in the offer, so you always know the payment terms before work starts. Unless the offer states otherwise, the price is payable before handover of the finished watch.</li><li>${vatText(L)}</li></ol>
<h2>3. Timing</h2>
<p>The completion date is set <strong>individually</strong> depending on the complexity of the work and the availability of parts. A fixed date applies only if expressly agreed. The Atelier informs the customer of any delay.</p>
<h2>4. Work and components</h2>
<ol><li>Vintage watches may reveal hidden defects when dismantled; the Atelier informs the customer and proceeds only with consent.</li><li>The Atelier always distinguishes <strong>original components</strong> from <strong>new components used in the Dante Time rebuild</strong>; the customer receives a list of replaced and new components. Replaced original parts are returned on request.</li><li>Precious metal cases: the Atelier records the fineness and hallmark on receipt, if present. Gold-plated cases are not polished in a way that would damage the plating without the customer’s consent.</li><li>Water resistance of vintage watches is not guaranteed unless agreed and tested. The indicative accuracy of vintage watches is ±30 s/day depending on calibre, condition and age.</li></ol>
<h2>5. Receipt and collection</h2>
<ol><li>Watches can be handed over in person <strong>by prior arrangement</strong> (the Atelier has no retail shop) or sent by insured parcel. The Atelier documents the condition with photos and confirms it by e-mail.</li><li>The customer collects the finished job within <strong>${T.pickupDays} days</strong> of notice of completion. <strong>No storage fee is charged.</strong> After that period the Atelier sends a reminder; if the watch is still not collected within a reasonable additional period, the Atelier proceeds under Section 2609 of the Civil Code.</li></ol>
<h2>6. Consumer withdrawal</h2>
<ol><li>Custom builds and rebuilds made to the consumer’s specification cannot be returned (Section 1837(d) Civil Code).</li><li>For service and restoration agreed at a distance, a consumer may withdraw within ${T.withdrawalDays} days of the contract. Any deposit paid is refunded, less a proportionate part of the price for work already carried out at their request. If the consumer expressly requests that work start earlier and then withdraws, they pay a proportionate part of the price; after full completion with their consent the right of withdrawal ends (Section 1837(a)).</li></ol>
<h2>7. Liability</h2>
<p>The Atelier is liable for the work done and new components for ${T.liabilityMonths} months from handover (see <a href="/en/complaints">Complaints Procedure</a>), and for watches received from customers while in its care under the Civil Code.</p>`);

export const shipping = doc('shipping', '/en/shipping-payment', 'Shipping and Payment',
  'Shipping in the Czech Republic and across the EU, payment by bank transfer (CZK, EUR) or cash on delivery in Czechia.',
  () => `${head(L)}
<h2>Shipping in the Czech Republic</h2>
<table><thead><tr><th>Method</th><th>Price</th></tr></thead><tbody>
<tr><td><strong>Packeta (Zásilkovna)</strong> – pickup point or Z-BOX (map selection)</td><td>${priceEn(T.defaultPrices.zasilkovna)}</td></tr>
<tr><td><strong>Balíkovna</strong> – pickup point (Czech Post map)</td><td>${priceEn(T.defaultPrices.balikovna)}</td></tr>
<tr><td><strong>Insured shipment</strong> – for higher-value watches</td><td>shown in the cart before ordering</td></tr>
<tr><td><strong>Personal handover</strong> – only by prior individual arrangement (no retail shop)</td><td>free</td></tr>
</tbody></table>
<h2>Shipping to EU countries</h2>
<p>We deliver to all 27 EU member states including Slovakia. The price depends on the destination country and available carrier and <strong>is shown in the cart after selecting the country, before the order is placed</strong>. For countries without a price yet, we will gladly prepare an offer.</p>
<h2>Dispatch</h2>
<p>Available watches are dispatched within <strong>${T.dispatchWorkingDays} working days</strong> of receipt of payment, or of order confirmation for cash on delivery. You receive the tracking number by e-mail. Higher-value watches are sent only by insured shipment corresponding to their value or handed over personally by arrangement.</p>
<h2>Payment</h2>
<table><thead><tr><th>Method</th><th>Fee</th><th>Note</th></tr></thead><tbody>
<tr><td><strong>Bank transfer in CZK</strong> with QR payment</td><td>free</td><td>due within ${T.paymentDueDays} days; details and QR code right after ordering</td></tr>
<tr><td><strong>Bank transfer in EUR</strong> with SEPA QR code</td><td>no fee from the Atelier</td><td>IBAN ${OPERATOR.ibanPretty}, BIC ${OPERATOR.bic}. EUR amount at the Atelier’s rate, rounded up to a whole euro</td></tr>
<tr><td><strong>Cash on delivery</strong> (Czechia only, Packeta and Balíkovna)</td><td>${priceEn(T.defaultPrices.cod)}</td><td>the watch is reserved until dispatch</td></tr>
<tr><td><strong>Card payment</strong></td><td>–</td><td>available once the payment gateway is activated</td></tr>
</tbody></table>
<p>International orders are paid in advance. ${vatText(L)} The invoice is sent by e-mail after payment.</p>
<p>Account holder: ${OPERATOR.accountHolder}, ${OPERATOR.bankName}, account number ${OPERATOR.bankAccount}.</p>`);

export const privacy = doc('privacy', '/en/privacy', 'Privacy Policy',
  'How Atelier Dante Time processes personal data of customers and website visitors under the GDPR.',
  () => `${head(L)}
<h2>1. Controller</h2>
<p>The controller is ${seller(L)}, e-mail ${email} (the “Controller”). No data protection officer has been appointed as the GDPR does not require one.</p>
<h2>2. Purposes, legal bases and retention</h2>
<table><thead><tr><th>Purpose</th><th>Data</th><th>Legal basis</th><th>Retention</th></tr></thead><tbody>
<tr><td>Enquiries and communication</td><td>name, e-mail, phone, message, photos</td><td>Art. 6(1)(b) GDPR</td><td>during communication and 1 year after if no contract</td></tr>
<tr><td>Conclusion and performance of contracts</td><td>name, e-mail, phone, address, country, pickup point, payments; company ID and VAT ID for businesses</td><td>Art. 6(1)(b)</td><td>during performance</td></tr>
<tr><td>Accounting and tax</td><td>data on documents</td><td>Art. 6(1)(c)</td><td>as required by tax and accounting law (usually 10 years)</td></tr>
<tr><td>Records of sales and purchases (including documents from suppliers and private sellers)</td><td>data on invoices and documents: name, address, e-mail, items, amounts</td><td>Art. 6(1)(c) and (f)</td><td>for the retention period of accounting documents</td></tr>
<tr><td>Claims, legal defence, authenticity guarantee</td><td>contract data, watch identification</td><td>Art. 6(1)(f) – legitimate interest</td><td>4 years after the contract ends; watch identification for the duration of the guarantee</td></tr>
<tr><td>Online withdrawal</td><td>name, e-mail, order number, statement</td><td>Art. 6(1)(c)</td><td>4 years</td></tr>
<tr><td>Website and admin security</td><td>IP address, time</td><td>Art. 6(1)(f)</td><td>up to 30 days</td></tr>
</tbody></table>
<p>No profiling, automated decision-making or marketing messages.</p>
<h2>3. Recipients and processors</h2>
<ul><li><strong>Cloudflare, Inc.</strong> – hosting, database (stored in the EU) and photos,</li><li><strong>Google</strong> – Gmail mailbox,</li><li><strong>Resend</strong> – sending e-mails from the website (order confirmations, invoices, replies to enquiries),</li><li><strong>Anthropic PBC</strong> (USA) – processing of documents using artificial intelligence for records of sales and purchases and drafting replies to enquiries (the enquiry text without contact details; the reply is always reviewed and sent by the operator),</li><li><strong>Packeta (Zásilkovna s.r.o.)</strong>, <strong>Czech Post (Česká pošta, s.p.)</strong> and other carriers depending on the destination – delivery,</li><li><strong>Česká spořitelna, a.s.</strong> – receipt of payments (as an independent controller),</li><li>the payment gateway provider – only once activated (its name will be added here),</li><li>public authorities where required by law.</li></ul>
<h2>4. Transfers outside the EU</h2>
<p>Cloudflare, Google and Resend may process data in the USA based on the Commission’s adequacy decision (EU–US Data Privacy Framework) or standard contractual clauses.</p>
<p>Anthropic PBC processes documents and enquiry texts in the USA based on standard contractual clauses. The data is not used to train models.</p>
<h2>5. Your rights</h2>
<p>You have the right of access, rectification, erasure, restriction, portability and to object to processing based on legitimate interest. Contact ${email}; we reply within one month. You may lodge a complaint with the Czech Office for Personal Data Protection (Pplk. Sochora 27, 170 00 Prague 7, <a href="https://uoou.gov.cz" rel="noopener noreferrer">uoou.gov.cz</a>) or the supervisory authority of your country of residence.</p>
<h2>6. Security</h2>
<p>The website uses HTTPS. The administration is protected by a password and two-factor authentication. Watch photos are stripped of metadata including location. Customer data is not stored in the public source code. The database is backed up regularly; backups are encrypted and kept for no more than 30 days.</p>`);

export const cookies = doc('cookies', '/en/cookies', 'Cookie Policy',
  'Which cookies and technical storage the Atelier Dante Time website uses and how to manage consent.',
  () => `${head(L)}
<p><strong>We use no analytics, marketing or advertising cookies.</strong> We only use technical storage strictly necessary for services you explicitly request, which does not require consent (Article 5(3) of Directive 2002/58/EC as implemented in Czech law).</p>
<p><button type="button" class="btn ghost" data-consent-open>Cookie settings</button></p>
<table><thead><tr><th>Name</th><th>Category</th><th>Purpose</th><th>Duration</th></tr></thead><tbody>
<tr><td><code>dt_cart</code></td><td>necessary</td><td>cart contents</td><td>until the cart is emptied</td></tr>
<tr><td><code>dt_consent</code></td><td>necessary</td><td>stores your cookie settings choice</td><td>12 months</td></tr>
<tr><td><code>__Host-dt_admin</code></td><td>necessary</td><td>admin login (operator only)</td><td>30 days</td></tr>
</tbody></table>
<h2>Third-party services</h2>
<ul><li>The <strong>pickup point map</strong> of Packeta or Balíkovna loads only after you click it in the cart; the carrier may use its own technical storage. The map uses your location only with your browser consent.</li><li><strong>Card payment</strong> (once activated) takes place on the payment gateway page with its necessary cookies.</li><li>Instagram, TikTok and Facebook are plain links and do not load on our website.</li></ul>
<h2>Consent management</h2>
<p>In <strong>Cookie settings</strong> (link in the footer of every page) you can grant or withdraw consent for optional categories (analytics, marketing) at any time. As long as we do not use them, they remain off; if introduced in future, they will not run without your consent.</p>`);

export const adr = doc('adr', '/en/dispute-resolution', 'Out-of-Court Dispute Resolution',
  'How to resolve a dispute with Atelier Dante Time: complaint, ADR at the Czech Trade Inspection Authority and cross-border help.',
  () => `${head(L)}
<ol>
<li><strong>Contact us first.</strong> We handle complaints at ${email}.</li>
<li><strong>Out-of-court resolution (ADR).</strong> If we do not reach agreement, a consumer may file a proposal for out-of-court resolution with the ${coi(L)}, no later than one year after first asserting the right with the seller. The procedure is free for consumers.</li>
<li><strong>Cross-border disputes.</strong> Consumers from other EU states can get help from the ${ecc(L)}.</li>
<li>The EU Online Dispute Resolution (ODR) platform was discontinued on 20 July 2025 (Regulation (EU) 2024/3228), so we do not refer to it.</li>
<li>The right to go to court is not affected.</li>
</ol>`);

export const eu = doc('eu', '/en/eu-sales', 'Sales to EU Countries',
  'Atelier Dante Time cross-border sales rules: delivery to all 27 EU states, payment in EUR, your rights.',
  () => `${head(L)}
<ol>
<li><strong>Where we deliver:</strong> all 27 member states of the European Union. The shipping price is shown for your country before the order is placed.</li>
<li><strong>Same conditions across the EU:</strong> in line with Regulation (EU) 2018/302 (geo-blocking) we offer the same prices and terms to customers from all EU states regardless of nationality or residence.</li>
<li><strong>Payment:</strong> international orders are paid in advance by bank transfer in EUR (SEPA QR code) or CZK, and by card once activated. Cash on delivery is not available abroad.</li>
<li><strong>Taxes and customs:</strong> ${vatText(L)} No customs duties apply within the EU.</li>
<li><strong>Your rights:</strong> the ${warrantyShortEn()}, statutory rights for defects (${T.liabilityMonths} months), the ${T.withdrawalDays}-day withdrawal right for finished watches and the lifetime authenticity guarantee apply equally across the EU. The contract is governed by Czech law, but consumers keep the protection of the mandatory rules of their country of residence (Article 6 Rome I).</li>
<li><strong>Returns from abroad:</strong> the consumer bears the cost of returning the watch, which may be higher than within Czechia. We recommend an insured parcel.</li>
<li><strong>Language:</strong> we communicate in Czech and English; the contract can be concluded in either language.</li>
<li><strong>Disputes:</strong> see <a href="/en/dispute-resolution">Dispute Resolution</a>, including the European Consumer Centre.</li>
</ol>`);

export const operator = doc('operator', '/en/legal-notice', 'Legal Notice',
  'Mandatory information about the operator of the Atelier Dante Time online shop: identification, contact, supervision and disputes.',
  () => `${head(L)}
<table><tbody>
<tr><th>Operator</th><td>${OPERATOR.name}</td></tr>
<tr><th>Trading name</th><td>${OPERATOR.tradeName} (Atelier Dante Time)</td></tr>
<tr><th>Legal form</th><td>${OPERATOR.legalFormEn}</td></tr>
<tr><th>Company ID (IČO)</th><td>${OPERATOR.ico}</td></tr>
<tr><th>VAT</th><td>${vatText(L)}</td></tr>
<tr><th>Registered address</th><td>${OPERATOR.addressEn}</td></tr>
<tr><th>Registration</th><td>${registerText(L)}</td></tr>
<tr><th>In business since</th><td>2 December 2025</td></tr>
<tr><th>E-mail</th><td>${email}</td></tr>
<tr><th>Bank details</th><td>IBAN ${OPERATOR.ibanPretty}, BIC ${OPERATOR.bic}</td></tr>
</tbody></table>
<p>${INDEPENDENCE.en}</p>
<h2>Supervision</h2>
<ul><li>Czech Trade Inspection Authority – <a href="https://www.coi.gov.cz" rel="noopener noreferrer">coi.gov.cz</a></li><li>Trade licensing: ${tradeOffice(L)}</li><li>Precious metal articles: Czech Assay Office (Puncovní úřad) – <a href="https://www.puncovniurad.cz" rel="noopener noreferrer">puncovniurad.cz</a></li><li>Personal data: Office for Personal Data Protection – <a href="https://uoou.gov.cz" rel="noopener noreferrer">uoou.gov.cz</a></li></ul>
<p>Dispute resolution: <a href="/en/dispute-resolution">Dispute Resolution</a>.</p>`);

export const DOCS_EN = [terms, claims, withdrawal, warranty, ...(SVC ? [custom] : []), shipping, privacy, cookies, adr, eu, operator];
