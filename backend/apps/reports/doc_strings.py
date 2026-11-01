"""
Arabic and French for the text the platform's documents (PDF / CSV) carry.

English text → (Arabic, French). A key with {0}, {1}… is a template for text built with
values; the values are translated too when they are known text. Figures, currency codes,
references and addresses stay as they are.
"""

TEXT: dict[str, tuple[str, str]] = {
    # --- every document ------------------------------------------------------ #
    "Account holder": ("صاحب الحساب", "Titulaire du compte"),
    "Email": ("البريد الإلكتروني", "E-mail"),
    "Wallet address": ("عنوان المحفظة", "Adresse du portefeuille"),
    "Wallet address — {0}": ("عنوان المحفظة — {0}", "Adresse du portefeuille — {0}"),
    "Document no.": ("رقم المستند", "N° du document"),
    "Issued": ("تاريخ الإصدار", "Émis le"),
    "{0} (continued)": ("{0} (تابع)", "{0} (suite)"),
    "Page {0} of {1}": ("صفحة {0} من {1}", "Page {0} sur {1}"),
    "No records.": ("لا توجد سجلات.", "Aucun enregistrement."),
    "Details": ("التفاصيل", "Détails"),
    "Total": ("الإجمالي", "Total"),
    "Net": ("الصافي", "Net"),
    "None": ("لا يوجد", "Aucun"),
    "Other": ("أخرى", "Autre"),
    "Account": ("الحساب", "Compte"),
    "Informational only — generated from your Capimax BRX account records. Not a tax document "
    "and not an offer of securities.": (
        "للعلم فقط — صادر من سجلات حسابك في Capimax BRX. ليس مستندًا ضريبيًا ولا عرضًا لأوراق مالية.",
        "À titre informatif uniquement — généré à partir de vos données de compte Capimax BRX. "
        "Ce n'est ni un document fiscal ni une offre de valeurs mobilières.",
    ),
    # --- periods ------------------------------------------------------------- #
    "{0} (UTC)": ("{0} (بتوقيت UTC)", "{0} (UTC)"),
    "All time, to {0}": ("كل الفترات حتى {0}", "Toute la période, jusqu'au {0}"),
    "Start – {0}": ("البداية – {0}", "Début – {0}"),
    "Holdings as of {0}": ("الحيازات بتاريخ {0}", "Avoirs au {0}"),
    "Tax year {0}": ("السنة الضريبية {0}", "Année fiscale {0}"),
    "at the issue date": ("في تاريخ الإصدار", "à la date d'émission"),
    # --- shared table headings ------------------------------------------------ #
    "Date": ("التاريخ", "Date"),
    "Type": ("النوع", "Type"),
    "Description": ("الوصف", "Description"),
    "Amount": ("المبلغ", "Montant"),
    "Amount (USD)": ("المبلغ (USD)", "Montant (USD)"),
    "Balance (USD)": ("الرصيد (USD)", "Solde (USD)"),
    "Reference": ("المرجع", "Référence"),
    "Property": ("العقار", "Bien"),
    "Properties": ("العقارات", "Biens"),
    "Location": ("الموقع", "Emplacement"),
    "Token": ("الرمز", "Jeton"),
    "Units": ("الوحدات", "Parts"),
    "Ownership": ("الملكية", "Propriété"),
    "Ownership %": ("الملكية %", "Propriété %"),
    "Own. %": ("الملكية %", "Prop. %"),
    "Value": ("القيمة", "Valeur"),
    "Value (USD)": ("القيمة (USD)", "Valeur (USD)"),
    "Unit price": ("سعر الوحدة", "Prix unitaire"),
    "Unit price (USD)": ("سعر الوحدة (USD)", "Prix unitaire (USD)"),
    "Average cost (USD)": ("متوسط التكلفة (USD)", "Coût moyen (USD)"),
    "Invested": ("المستثمر", "Investi"),
    "Invested (USD)": ("المستثمر (USD)", "Investi (USD)"),
    "Gain / loss": ("الربح / الخسارة", "Gain / perte"),
    "Gain (USD)": ("الربح (USD)", "Gain (USD)"),
    "Status": ("الحالة", "Statut"),
    "Standard": ("المعيار", "Norme"),
    "Network": ("الشبكة", "Réseau"),
    "Contract address": ("عنوان العقد", "Adresse du contrat"),
    "Certificate": ("الشهادة", "Certificat"),
    "Period": ("الفترة", "Période"),
    "Pay date": ("تاريخ الدفع", "Date de paiement"),
    "Income (USD)": ("الدخل (USD)", "Revenu (USD)"),
    "Method": ("الطريقة", "Méthode"),
    "Cost (USD)": ("التكلفة (USD)", "Coût (USD)"),
    "Fee (USD)": ("الرسوم (USD)", "Frais (USD)"),
    "Fees (USD)": ("الرسوم (USD)", "Frais (USD)"),
    "Gross (USD)": ("الإجمالي (USD)", "Brut (USD)"),
    "Net (USD)": ("الصافي (USD)", "Net (USD)"),
    "Net proceeds (USD)": ("صافي العائدات (USD)", "Produit net (USD)"),
    "Units sold": ("الوحدات المباعة", "Parts vendues"),
    "Investors": ("المستثمرون", "Investisseurs"),
    "Referred investor": ("المستثمر المُحال", "Investisseur parrainé"),
    "Investment (USD)": ("الاستثمار (USD)", "Investissement (USD)"),
    "Commission (USD)": ("العمولة (USD)", "Commission (USD)"),
    "Due date": ("تاريخ الاستحقاق", "Échéance"),
    "Paid on": ("تاريخ السداد", "Payé le"),
    "Paid date": ("تاريخ السداد", "Date de paiement"),
    "Plan value": ("قيمة الخطة", "Valeur du plan"),
    "Paid": ("مدفوع", "Payé"),
    "Remaining": ("المتبقي", "Restant"),
    "Next due": ("الاستحقاق القادم", "Prochaine échéance"),
    "Of portfolio": ("من المحفظة", "% du total"),
    "Of portfolio %": ("من المحفظة %", "% du total"),
    "Return": ("العائد", "Rendement"),
    "Month": ("الشهر", "Mois"),
    "DP": ("مقدم", "Ac."),
    # --- wallet statement ------------------------------------------------------ #
    "Wallet Account Statement": ("كشف حساب المحفظة", "Relevé de compte du portefeuille"),
    "Generated from the Capimax BRX wallet ledger. Times are UTC; the period includes both dates. "
    "A withdrawal being paid out is shown when it was booked. This statement is informational "
    "and is not a tax document.": (
        "صادر من سجل محفظة Capimax BRX. الأوقات بتوقيت UTC، وتشمل الفترة التاريخين. يظهر السحب "
        "الجاري صرفه بتاريخ تسجيله. هذا الكشف للعلم فقط وليس مستندًا ضريبيًا.",
        "Généré à partir du registre du portefeuille Capimax BRX. Les heures sont en UTC ; la "
        "période inclut les deux dates. Un retrait en cours de paiement apparaît à sa date "
        "d'enregistrement. Ce relevé est informatif et n'est pas un document fiscal.",
    ),
    "Opening balance": ("الرصيد الافتتاحي", "Solde d'ouverture"),
    "Money in": ("الوارد", "Entrées"),
    "Money out": ("الصادر", "Sorties"),
    "Closing balance": ("الرصيد الختامي", "Solde de clôture"),
    "Movements": ("الحركات", "Mouvements"),
    "Available now": ("المتاح الآن", "Disponible"),
    "Wallet movements": ("حركات المحفظة", "Mouvements du portefeuille"),
    "No wallet movements in this period.": ("لا توجد حركات في هذه الفترة.", "Aucun mouvement sur cette période."),
    "Net change": ("صافي التغير", "Variation nette"),
    "Property units held": ("وحدات العقارات المملوكة", "Parts de biens détenues"),
    "No property units held.": ("لا توجد وحدات مملوكة.", "Aucune part détenue."),
    "Ref. {0}": ("مرجع {0}", "Réf. {0}"),
    # --- portfolio ------------------------------------------------------------- #
    "Portfolio Statement": ("كشف المحفظة الاستثمارية", "Relevé de portefeuille"),
    "Values use each property's current unit price; units on a running installment plan are shown "
    "net of the installments still owed. Figures come from your Capimax BRX account records and "
    "are not an offer or a valuation report.": (
        "تُحسب القيم بسعر الوحدة الحالي لكل عقار، وتظهر الوحدات ضمن خطة أقساط جارية بعد خصم الأقساط "
        "المستحقة. الأرقام من سجلات حسابك في Capimax BRX وليست عرضًا ولا تقرير تقييم.",
        "Les valeurs utilisent le prix unitaire actuel de chaque bien ; les parts d'un plan de "
        "versements en cours sont indiquées nettes des versements restants. Les chiffres "
        "proviennent de vos données Capimax BRX et ne constituent ni une offre ni un rapport "
        "d'évaluation.",
    ),
    "Units held": ("الوحدات المملوكة", "Parts détenues"),
    "Distributions received": ("التوزيعات المستلمة", "Distributions reçues"),
    "Total invested": ("إجمالي المستثمر", "Total investi"),
    "Current value": ("القيمة الحالية", "Valeur actuelle"),
    "Holdings": ("الحيازات", "Avoirs"),
    "On-chain token contracts": ("عقود الرموز على البلوكتشين", "Contrats de jetons on-chain"),
    "No contracts.": ("لا توجد عقود.", "Aucun contrat."),
    "Pending deployment": ("بانتظار النشر", "Déploiement en attente"),
    "Ownership certificates": ("شهادات الملكية", "Certificats de propriété"),
    "No certificates issued yet.": ("لم تصدر شهادات بعد.", "Aucun certificat émis pour l'instant."),
    # --- distributions ----------------------------------------------------------- #
    "Distributions Statement": ("كشف التوزيعات", "Relevé des distributions"),
    "Rental income credited to your Capimax BRX wallet. Informational statement from your account "
    "records; not a tax document.": (
        "دخل إيجار مضاف إلى محفظتك في Capimax BRX. كشف للعلم فقط من سجلات حسابك وليس مستندًا ضريبيًا.",
        "Revenus locatifs crédités sur votre portefeuille Capimax BRX. Relevé informatif issu de "
        "vos données de compte ; ce n'est pas un document fiscal.",
    ),
    "Total received": ("إجمالي المستلم", "Total reçu"),
    "Payouts": ("المدفوعات", "Versements"),
    "No distributions in this period.": ("لا توجد توزيعات في هذه الفترة.", "Aucune distribution sur cette période."),
    "Annual Distribution Income Summary": ("الملخص السنوي لدخل التوزيعات", "Résumé annuel des revenus de distribution"),
    "Informational annual summary of distribution income from your account records. This is NOT a "
    "tax document, NOT tax advice and NOT an official statement — consult a qualified "
    "professional.": (
        "ملخص سنوي للعلم فقط لدخل التوزيعات من سجلات حسابك. هذا ليس مستندًا ضريبيًا ولا استشارة "
        "ضريبية ولا كشفًا رسميًا — يُرجى استشارة مختص مؤهل.",
        "Résumé annuel informatif des revenus de distribution issu de vos données de compte. Ce "
        "n'est NI un document fiscal, NI un conseil fiscal, NI un relevé officiel — consultez un "
        "professionnel qualifié.",
    ),
    "Tax year": ("السنة الضريبية", "Année fiscale"),
    "Total distribution income": ("إجمالي دخل التوزيعات", "Total des revenus de distribution"),
    "By property": ("حسب العقار", "Par bien"),
    "No distribution income in this year.": ("لا يوجد دخل توزيعات في هذه السنة.", "Aucun revenu de distribution cette année."),
    "No payouts in this year.": ("لا توجد مدفوعات في هذه السنة.", "Aucun versement cette année."),
    "Rental": ("إيجار", "Location"),
    # --- owner -------------------------------------------------------------------- #
    "Owner Earnings Report": ("تقرير أرباح المالك", "Rapport des gains du propriétaire"),
    "Primary sales of your listed properties (resales between investors are not included). "
    "Buyer-paid fees are not deducted from your proceeds.": (
        "المبيعات الأولية لعقاراتك المدرجة (لا تشمل إعادة البيع بين المستثمرين). الرسوم التي يدفعها "
        "المشتري لا تُخصم من عائداتك.",
        "Ventes primaires de vos biens listés (hors reventes entre investisseurs). Les frais payés "
        "par l'acheteur ne sont pas déduits de votre produit.",
    ),
    "Net proceeds": ("صافي العائدات", "Produit net"),
    "No listed properties.": ("لا توجد عقارات مدرجة.", "Aucun bien listé."),
    # --- liquidity provider --------------------------------------------------------- #
    "Liquidity Provider Statement": ("كشف مزود السيولة", "Relevé du fournisseur de liquidité"),
    "Generated from your Capimax BRX liquidity-provider ledger. Withdrawals leave your balance when "
    "requested and return if a payout fails. Informational statement.": (
        "صادر من سجل مزود السيولة الخاص بك في Capimax BRX. يُخصم السحب من رصيدك عند طلبه ويعود إذا "
        "تعذّر الصرف. كشف للعلم فقط.",
        "Généré à partir de votre registre de fournisseur de liquidité Capimax BRX. Les retraits "
        "quittent votre solde à la demande et reviennent si le paiement échoue. Relevé informatif.",
    ),
    "In this period": ("الوارد في الفترة", "Entrées de la période"),
    "Out this period": ("الصادر في الفترة", "Sorties de la période"),
    "Transactions": ("المعاملات", "Transactions"),
    "Total deposited": ("إجمالي الإيداعات", "Total déposé"),
    "Total earnings": ("إجمالي الأرباح", "Total des gains"),
    "Total withdrawn": ("إجمالي السحوبات", "Total retiré"),
    "Current balance": ("الرصيد الحالي", "Solde actuel"),
    "Company": ("الشركة", "Société"),
    "No transactions in this period.": ("لا توجد معاملات في هذه الفترة.", "Aucune transaction sur cette période."),
    "No units held.": ("لا توجد وحدات مملوكة.", "Aucune part détenue."),
    # --- broker ------------------------------------------------------------------------ #
    "Broker Commissions Statement": ("كشف عمولات البروكر", "Relevé des commissions du courtier"),
    "Commissions on investments made by the investors you referred.": (
        "عمولات على استثمارات المستثمرين الذين أحلتهم.",
        "Commissions sur les investissements des investisseurs que vous avez parrainés.",
    ),
    "Commission in period": ("عمولة الفترة", "Commission de la période"),
    "Commissions": ("العمولات", "Commissions"),
    "All-time commission": ("إجمالي العمولات", "Commission totale"),
    "No commissions in this period.": ("لا توجد عمولات في هذه الفترة.", "Aucune commission sur cette période."),
    # --- installments -------------------------------------------------------------------- #
    "Installment Plans Statement": ("كشف خطط الأقساط", "Relevé des plans de versements"),
    "Your installment plans as recorded on Capimax BRX. Units on a plan become fully yours with the "
    "final payment; a missed installment can lead to the plan being cancelled under its terms.": (
        "خطط أقساطك كما هي مسجلة في Capimax BRX. تصبح وحدات الخطة ملكك بالكامل مع آخر دفعة، وقد يؤدي "
        "تفويت قسط إلى إلغاء الخطة وفق شروطها.",
        "Vos plans de versements tels qu'enregistrés sur Capimax BRX. Les parts d'un plan vous "
        "appartiennent entièrement au dernier paiement ; un versement manqué peut entraîner "
        "l'annulation du plan selon ses conditions.",
    ),
    "Plans": ("الخطط", "Plans"),
    "Total plan value": ("إجمالي قيمة الخطط", "Valeur totale des plans"),
    "Paid to date": ("المدفوع حتى الآن", "Payé à ce jour"),
    "No installment plans.": ("لا توجد خطط أقساط.", "Aucun plan de versements."),
    "Payment schedule": ("جدول السداد", "Calendrier de paiement"),
    "No payments in this period.": ("لا توجد دفعات في هذه الفترة.", "Aucun paiement sur cette période."),
    "No payments.": ("لا توجد دفعات.", "Aucun paiement."),
    "Installment Schedule": ("جدول الأقساط", "Calendrier des versements"),
    "This schedule reflects the installment plan recorded on Capimax BRX at the issue date. Units "
    "on the plan become fully yours with the final payment.": (
        "يعكس هذا الجدول خطة الأقساط المسجلة في Capimax BRX في تاريخ الإصدار. تصبح وحدات الخطة ملكك "
        "بالكامل مع آخر دفعة.",
        "Ce calendrier reflète le plan de versements enregistré sur Capimax BRX à la date "
        "d'émission. Les parts du plan vous appartiennent entièrement au dernier paiement.",
    ),
    "Plan status": ("حالة الخطة", "Statut du plan"),
    "Down payment": ("الدفعة المقدمة", "Acompte"),
    "Installments": ("الأقساط", "Versements"),
    "Frequency": ("التكرار", "Fréquence"),
    "Fee rate": ("نسبة الرسوم", "Taux de frais"),
    # --- investment report ------------------------------------------------------------------ #
    "Investment Performance Report": ("تقرير أداء الاستثمار", "Rapport de performance des investissements"),
    "Performance is measured on holdings with a recorded cost, at today's unit prices. Past "
    "performance does not guarantee future results. Informational report from your Capimax BRX "
    "account records.": (
        "يُقاس الأداء على الحيازات ذات التكلفة المسجلة وبأسعار الوحدات الحالية. الأداء السابق لا يضمن "
        "النتائج المستقبلية. تقرير للعلم فقط من سجلات حسابك في Capimax BRX.",
        "La performance est mesurée sur les avoirs dont le coût est enregistré, aux prix unitaires "
        "du jour. Les performances passées ne garantissent pas les résultats futurs. Rapport "
        "informatif issu de vos données de compte Capimax BRX.",
    ),
    "Income in period": ("دخل الفترة", "Revenus de la période"),
    "Allocation and return by property": ("التوزيع والعائد حسب العقار", "Répartition et rendement par bien"),
    "No holdings.": ("لا توجد حيازات.", "Aucun avoir."),
    "Allocation by location": ("التوزيع حسب الموقع", "Répartition par emplacement"),
    "Rental income by month": ("دخل الإيجار حسب الشهر", "Revenus locatifs par mois"),
    "No rental income in this period.": ("لا يوجد دخل إيجار في هذه الفترة.", "Aucun revenu locatif sur cette période."),
    # --- receipts ------------------------------------------------------------------------------ #
    "Receipt generated from Capimax BRX account records. Keep it for your records; it is not a "
    "tax invoice.": (
        "إيصال صادر من سجلات حسابك في Capimax BRX. احتفظ به في سجلاتك، وهو ليس فاتورة ضريبية.",
        "Reçu généré à partir de vos données de compte Capimax BRX. Conservez-le ; ce n'est pas "
        "une facture fiscale.",
    ),
    "Payment Receipt": ("إيصال دفع", "Reçu de paiement"),
    "Wallet Transaction Receipt": ("إيصال معاملة المحفظة", "Reçu de transaction du portefeuille"),
    "Paid with": ("طريقة الدفع", "Payé avec"),
    "Payment date": ("تاريخ الدفع", "Date de paiement"),
    "Receipt no.": ("رقم الإيصال", "N° du reçu"),
    "Payment reference": ("مرجع الدفع", "Référence du paiement"),
    "Wallet balance": ("رصيد المحفظة", "Solde du portefeuille"),
    "{0} — credited to your wallet": ("{0} — أُضيف إلى محفظتك", "{0} — crédité sur votre portefeuille"),
    "{0} — debited from your wallet": ("{0} — خُصم من محفظتك", "{0} — débité de votre portefeuille"),
    "Early payoff of the installments of {0}": ("سداد مبكر لأقساط {0}", "Remboursement anticipé des versements de {0}"),
    "Installment {0}/{1} — {2}": ("القسط {0}/{1} — {2}", "Versement {0}/{1} — {2}"),
    "Installment fee ({0}%)": ("رسوم القسط ({0}%)", "Frais de versement ({0}%)"),
    "Down payment — {0} unit(s) of {1}": ("دفعة مقدمة — {0} وحدة من {1}", "Acompte — {0} part(s) de {1}"),
    "{0} unit(s) of {1} at {2}": ("{0} وحدة من {1} بسعر {2}", "{0} part(s) de {1} à {2}"),
    "Fees": ("الرسوم", "Frais"),
    "Discount": ("الخصم", "Remise"),
    "Card (Stripe)": ("بطاقة (Stripe)", "Carte (Stripe)"),
    "Crypto (NOWPayments)": ("كريبتو (NOWPayments)", "Crypto (NOWPayments)"),
    "Wallet": ("المحفظة", "Portefeuille"),
    # --- wallet ledger sources (statements + receipts) ------------------------------------------- #
    "Wallet top-up": ("شحن المحفظة", "Recharge du portefeuille"),
    "Withdrawal request": ("طلب سحب", "Demande de retrait"),
    "Withdrawal not completed — amount returned": ("سحب لم يكتمل — أُعيد المبلغ", "Retrait non abouti — montant restitué"),
    "Instant withdrawal fee returned": ("استرداد رسوم السحب الفوري", "Frais de retrait instantané restitués"),
    "Gift sent": ("هدية مُرسلة", "Don envoyé"),
    "Gift received": ("هدية مُستلمة", "Don reçu"),
    "Gift returned": ("هدية مُعادة", "Don restitué"),
    "Family transfer sent": ("تحويل عائلي مُرسل", "Transfert familial envoyé"),
    "Family transfer received": ("تحويل عائلي مُستلم", "Transfert familial reçu"),
    "Family transfer returned": ("تحويل عائلي مُعاد", "Transfert familial restitué"),
    "Inheritance distributed": ("توزيع ميراث", "Succession répartie"),
    "Inheritance received": ("ميراث مُستلم", "Succession reçue"),
    "Inheritance returned": ("ميراث مُعاد", "Succession restituée"),
    "Purchase paid from the wallet": ("شراء من المحفظة", "Achat payé depuis le portefeuille"),
    "Installment paid from the wallet": ("قسط مدفوع من المحفظة", "Versement payé depuis le portefeuille"),
    "Installment auto-debited from the wallet": ("خصم قسط تلقائي من المحفظة", "Versement prélevé automatiquement du portefeuille"),
    "Rental income distribution": ("توزيع دخل الإيجار", "Distribution de revenus locatifs"),
    "Secondary market purchase": ("شراء من السوق الثانوي", "Achat sur le marché secondaire"),
    "Secondary market sale proceeds": ("عائدات بيع في السوق الثانوي", "Produit de vente sur le marché secondaire"),
    "Sale to a liquidity provider": ("بيع لمزود سيولة", "Vente à un fournisseur de liquidité"),
    "Primary sale proceeds": ("عائدات البيع الأولي", "Produit de la vente primaire"),
    "Referral commission": ("عمولة إحالة", "Commission de parrainage"),
    "Purchase refunded to the wallet": ("استرداد مبلغ شراء للمحفظة", "Achat remboursé sur le portefeuille"),
    "Crypto payment below the amount due — returned": ("دفعة كريبتو أقل من المستحق — أُعيدت", "Paiement crypto inférieur au montant dû — restitué"),
    "Crypto payment above the amount due — extra credited": ("دفعة كريبتو أعلى من المستحق — أُضيف الفرق", "Paiement crypto supérieur au montant dû — surplus crédité"),
    "Family allocation released": ("تحرير مخصص عائلي", "Allocation familiale libérée"),
    # --- wallet ledger memos --------------------------------------------------------------------- #
    "Distribution {0}: {1}": ("توزيع {0}: {1}", "Distribution {0} : {1}"),
    "Reinvestment: {0} {1} of {2}": ("إعادة استثمار: {0} {1} من {2}", "Réinvestissement : {0} {1} de {2}"),
    "Purchase: {0} {1} of {2}": ("شراء: {0} {1} من {2}", "Achat : {0} {1} de {2}"),
    "Installment {0} of {1}": ("القسط {0} من {1}", "Versement {0} de {1}"),
    "Primary sale ({0})": ("بيع أولي ({0})", "Vente primaire ({0})"),
    "Primary sale: {0} {1} of {2}": ("بيع أولي: {0} {1} من {2}", "Vente primaire : {0} {1} de {2}"),
    "Referral commission ({0})": ("عمولة إحالة ({0})", "Commission de parrainage ({0})"),
    "Referral commission ({0}%): {1} of {2}": ("عمولة إحالة ({0}%): {1} من {2}", "Commission de parrainage ({0}%) : {1} de {2}"),
    "Refund: {0} {1} of {2} ({3})": ("استرداد: {0} {1} من {2} ({3})", "Remboursement : {0} {1} de {2} ({3})"),
    "Sale of {0} {1}": ("بيع {0} {1}", "Vente de {0} {1}"),
    "Buy {0} {1}": ("شراء {0} {1}", "Achat de {0} {1}"),
    "Buy installment position: {0} {1}": ("شراء مركز أقساط: {0} {1}", "Achat d'une position à versements : {0} {1}"),
    "Sale of installment position: {0} {1}": ("بيع مركز أقساط: {0} {1}", "Vente d'une position à versements : {0} {1}"),
    "Family allocation carve · {0}": ("اقتطاع مخصص عائلي · {0}", "Prélèvement d'allocation familiale · {0}"),
    "Family accrual release · {0}": ("تحرير مستحقات عائلية · {0}", "Libération d'allocation familiale · {0}"),
    "Owner withdrawal {0}": ("سحب المالك {0}", "Retrait du propriétaire {0}"),
    "Withdrawal {0} was not completed — amount returned": ("السحب {0} لم يكتمل — أُعيد المبلغ", "Le retrait {0} n'a pas abouti — montant restitué"),
    "Gift {0} to {1}": ("هدية {0} إلى {1}", "Don {0} à {1}"),
    "Gift {0} returned": ("هدية {0} مُعادة", "Don {0} restitué"),
    "Gift {0} from {1}": ("هدية {0} من {1}", "Don {0} de {1}"),
    "Family transfer {0} to {1}": ("تحويل عائلي {0} إلى {1}", "Transfert familial {0} à {1}"),
    "Family transfer {0} returned": ("تحويل عائلي {0} مُعاد", "Transfert familial {0} restitué"),
    "Family transfer {0} from {1}": ("تحويل عائلي {0} من {1}", "Transfert familial {0} de {1}"),
    "Inheritance {0} to {1}": ("ميراث {0} إلى {1}", "Succession {0} à {1}"),
    "Inheritance {0} returned": ("ميراث {0} مُعاد", "Succession {0} restituée"),
    "Inheritance {0} from {1}": ("ميراث {0} من {1}", "Succession {0} de {1}"),
    "More crypto arrived after the purchase was cancelled (+${0})": ("وصل مبلغ كريبتو إضافي بعد إلغاء الشراء (+${0})", "Crypto supplémentaire reçue après l'annulation de l'achat (+${0})"),
    "Crypto payment below the amount due — ${0} returned": ("دفعة كريبتو أقل من المستحق — أُعيد ${0}", "Paiement crypto inférieur au montant dû — ${0} restitués"),
    "Instant payout not available for {0} — fee returned": ("الصرف الفوري غير متاح لـ {0} — أُعيدت الرسوم", "Paiement instantané indisponible pour {0} — frais restitués"),
    "Crypto payment above the amount due (+${0})": ("دفعة كريبتو أعلى من المستحق (+${0})", "Paiement crypto supérieur au montant dû (+${0})"),
    # --- statuses and kinds --------------------------------------------------------------------- #
    "Pending": ("قيد الانتظار", "En attente"),
    "Missed": ("فائت", "Manqué"),
    "Cancelled": ("ملغى", "Annulé"),
    "Completed": ("مكتمل", "Terminé"),
    "Active": ("نشط", "Actif"),
    "Defaulted": ("متعثر", "En défaut"),
    "Draft": ("مسودة", "Brouillon"),
    "Processing": ("قيد المعالجة", "En cours"),
    "Failed": ("فشل", "Échoué"),
    "Approved": ("معتمد", "Approuvé"),
    "Rejected": ("مرفوض", "Refusé"),
    "Final": ("نهائية", "Définitif"),
    "Provisional": ("مؤقتة", "Provisoire"),
    "Revoked": ("ملغاة", "Révoqué"),
    "Credited": ("مُضاف", "Crédité"),
    "Succeeded": ("ناجح", "Réussi"),
    "Upcoming": ("قادم", "À venir"),
    "Overdue": ("متأخر", "En retard"),
    "Registered": ("مسجل", "Inscrit"),
    "Held": ("محتفظ به", "Détenu"),
    "Listed": ("معروض", "En vente"),
    "Listed lp": ("معروض لمزود السيولة", "En vente (LP)"),
    "Listed secondary": ("معروض في السوق الثانوي", "En vente (secondaire)"),
    "Sold": ("مُباع", "Vendu"),
    "Deposit": ("إيداع", "Dépôt"),
    "Withdrawal": ("سحب", "Retrait"),
    "Earnings": ("أرباح", "Gains"),
    "Earning": ("أرباح", "Gains"),
    "Bank": ("بنك", "Banque"),
    "Crypto": ("كريبتو", "Crypto"),
    "Monthly": ("شهري", "Mensuel"),
    "Quarterly": ("ربع سنوي", "Trimestriel"),
    "Annual": ("سنوي", "Annuel"),
    "Yearly": ("سنوي", "Annuel"),
    "Semi-annual": ("نصف سنوي", "Semestriel"),
    "Special": ("خاص", "Spécial"),
    "Special / one-off": ("خاص / لمرة واحدة", "Spécial / ponctuel"),
    # --- ownership certificate ------------------------------------------------------------------ #
    "Certificate of Ownership": ("شهادة ملكية", "Certificat de propriété"),
    "Fractional ownership of a tokenised property": ("ملكية جزئية لعقار مرمّز", "Propriété fractionnée d'un bien tokenisé"),
    "This certificate records fractional ownership held through the property's SPV and recorded "
    "on-chain. Verify it at any time with the QR code or the verification code. A provisional "
    "certificate becomes final when the purchase is fully settled.": (
        "تثبت هذه الشهادة ملكية جزئية محتفظ بها من خلال الشركة ذات الغرض الخاص (SPV) للعقار ومسجلة "
        "على البلوكتشين. يمكن التحقق منها في أي وقت عبر رمز QR أو رمز التحقق. تصبح الشهادة المؤقتة "
        "نهائية عند سداد قيمة الشراء بالكامل.",
        "Ce certificat atteste une propriété fractionnée détenue par la SPV du bien et enregistrée "
        "on-chain. Vérifiez-le à tout moment avec le QR code ou le code de vérification. Un "
        "certificat provisoire devient définitif une fois l'achat entièrement réglé.",
    ),
    "This certifies that": ("تشهد هذه الوثيقة بأن", "Le présent certificat atteste que"),
    "is the registered holder of 1 unit of {0}, representing {1}% ownership.": (
        "هو المالك المسجل لوحدة واحدة من {0}، بما يمثل {1}% من الملكية.",
        "est le détenteur enregistré de 1 part de {0}, représentant {1}% de propriété.",
    ),
    "is the registered holder of {0} units of {1}, representing {2}% ownership.": (
        "هو المالك المسجل لعدد {0} وحدة من {1}، بما يمثل {2}% من الملكية.",
        "est le détenteur enregistré de {0} parts de {1}, représentant {2}% de propriété.",
    ),
    "Holder": ("المالك", "Détenteur"),
    "Name": ("الاسم", "Nom"),
    "Investor ID": ("معرّف المستثمر", "ID investisseur"),
    "Property & SPV": ("العقار والشركة ذات الغرض الخاص", "Bien et SPV"),
    "SPV": ("SPV", "SPV"),
    "Investment": ("الاستثمار", "Investissement"),
    "Units / tokens": ("الوحدات / الرموز", "Parts / jetons"),
    "Investment amount": ("مبلغ الاستثمار", "Montant de l'investissement"),
    "On-chain record": ("السجل على البلوكتشين", "Registre on-chain"),
    "Holder wallet": ("محفظة المالك", "Portefeuille du détenteur"),
    "Token contract": ("عقد الرمز", "Contrat du jeton"),
    "Standard / network": ("المعيار / الشبكة", "Norme / réseau"),
    "Listing ID": ("معرّف الإدراج", "ID de l'annonce"),
    "Scan to verify": ("امسح للتحقق", "Scanner pour vérifier"),
    "Issue date": ("تاريخ الإصدار", "Date d'émission"),
    "Subscription date": ("تاريخ الاكتتاب", "Date de souscription"),
    "Verification code": ("رمز التحقق", "Code de vérification"),
    "Verify at": ("التحقق عبر", "Vérifier sur"),
    "Digital signature": ("التوقيع الرقمي", "Signature numérique"),
    "Authorized Signatory": ("المفوّض بالتوقيع", "Signataire autorisé"),
    "Capimax BRX - Authorized Signatory": ("Capimax BRX - المفوّض بالتوقيع", "Capimax BRX - Signataire autorisé"),
    "For and on behalf of Capimax BRX": ("بالنيابة عن Capimax BRX", "Pour le compte de Capimax BRX"),
    # --- beneficiary certificate ------------------------------------------------------------------ #
    "Beneficiary Designation Certificate": ("شهادة تعيين المستفيدين", "Certificat de désignation des bénéficiaires"),
    "Certificate {0}": ("الشهادة {0}", "Certificat {0}"),
    "Beneficiaries": ("المستفيدون", "Bénéficiaires"),
    "Beneficiary": ("المستفيد", "Bénéficiaire"),
    "Relationship": ("صلة القرابة", "Lien de parenté"),
    "Share": ("الحصة", "Part"),
    "Certificate number": ("رقم الشهادة", "Numéro du certificat"),
    "Last updated": ("آخر تحديث", "Dernière mise à jour"),
    "A beneficiary submits a claim with this number and an official death certificate. After "
    "review, the holder's free property units and wallet balance are divided in the shares above.": (
        "يقدّم المستفيد طلبًا بهذا الرقم مع شهادة وفاة رسمية. وبعد المراجعة تُقسَّم وحدات العقارات "
        "غير المقيّدة ورصيد المحفظة لصاحب الحساب وفق الحصص الموضحة أعلاه.",
        "Un bénéficiaire dépose une demande avec ce numéro et un acte de décès officiel. Après "
        "examen, les parts libres et le solde du portefeuille du titulaire sont répartis selon "
        "les parts ci-dessus.",
    ),
    # --- installment plan preview --------------------------------------------------------------------- #
    "Installment Plan": ("خطة الأقساط", "Plan de versements"),
    "Preview of the plan you are about to start — confirmed at checkout. Amounts in USD.": (
        "معاينة للخطة التي ستبدأها — تُؤكَّد عند الدفع. المبالغ بالدولار الأمريكي.",
        "Aperçu du plan que vous allez démarrer — confirmé au paiement. Montants en USD.",
    ),
    "Total price": ("السعر الإجمالي", "Prix total"),
    "Due today": ("المستحق اليوم", "À payer aujourd'hui"),
    "Monthly installment": ("القسط الشهري", "Versement mensuel"),
    "{0} monthly": ("{0} شهريًا", "{0} mensuels"),
    "Installment fee": ("رسوم القسط", "Frais de versement"),
    "The down payment today, then one installment a month.": (
        "الدفعة المقدمة اليوم، ثم قسط كل شهر.",
        "L'acompte aujourd'hui, puis un versement par mois.",
    ),
    "Installment {0}": ("القسط {0}", "Versement {0}"),
    "Payment": ("الدفعة", "Paiement"),
    "To pay (USD)": ("للدفع (USD)", "À payer (USD)"),
    "Remaining (USD)": ("المتبقي (USD)", "Restant (USD)"),
    "Ownership grows with every payment: the units are recorded at once and released as they are "
    "paid. Installments are charged on their due dates from the method you choose.": (
        "تزداد الملكية مع كل دفعة: تُسجَّل الوحدات فورًا وتُحرَّر مع سدادها. وتُحصَّل الأقساط في مواعيد "
        "استحقاقها بالطريقة التي تختارها.",
        "La propriété augmente à chaque paiement : les parts sont enregistrées immédiatement et "
        "libérées au fur et à mesure du paiement. Les versements sont prélevés à leur échéance "
        "avec le moyen de paiement choisi.",
    ),
}

# Month names for dates in documents, January first.
MONTHS = {
    "ar": ("يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر",
           "أكتوبر", "نوفمبر", "ديسمبر"),
    "fr": ("janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.",
           "nov.", "déc."),
}
