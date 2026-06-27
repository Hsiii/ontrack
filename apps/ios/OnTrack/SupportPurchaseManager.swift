import Foundation
import StoreKit

@MainActor
final class SupportPurchaseManager: ObservableObject {
    static let supporterProductID = "ontrack.supporter_pack"

    @Published private(set) var supporterProduct: Product?
    @Published private(set) var isSupporter = false
    @Published private(set) var isLoading = false
    @Published private(set) var thankYouDialogID = 0
#if DEBUG
    @Published private(set) var supporterDisplayPriceOverride: String?
#endif
    @Published var statusMessage: String?

    private var updatesTask: Task<Void, Never>?
    private var usesFreshStoreKitFlow = false
    private var acceptsFreshStoreKitTransactions = false

    deinit {
        updatesTask?.cancel()
    }

    func start() async {
#if DEBUG
        usesFreshStoreKitFlow = ProcessInfo.processInfo.environment["ONTRACK_FRESH_STOREKIT_FLOW"] == "1"
            || ProcessInfo.processInfo.arguments.contains("--fresh-storekit-flow")
        supporterDisplayPriceOverride = ProcessInfo.processInfo.environment["ONTRACK_SUPPORTER_DISPLAY_PRICE"]
#endif

        if updatesTask == nil {
            updatesTask = listenForTransactions()
        }

        await loadProducts()

        if usesFreshStoreKitFlow {
            isSupporter = false
            return
        }

        await refreshEntitlements()
    }

    var supporterDisplayPrice: String? {
        if let supporterProduct {
            return supporterProduct.displayPrice
        }

#if DEBUG
        return supporterDisplayPriceOverride
#else
        return nil
#endif
    }

    func purchaseSupporterPack() async {
        guard !isLoading else {
            return
        }

        isLoading = true
        statusMessage = nil
        defer { isLoading = false }

        do {
            let product: Product
            if let supporterProduct {
                product = supporterProduct
            } else {
                product = try await loadSupporterProduct()
                supporterProduct = product
            }

            let result = try await product.purchase()

            switch result {
            case .success(let verification):
                let transaction = try checkVerified(verification)
                acceptsFreshStoreKitTransactions = true
                isSupporter = true
                thankYouDialogID += 1
                await transaction.finish()
            case .pending:
                statusMessage = AppText.purchasePending
            case .userCancelled:
                break
            @unknown default:
                statusMessage = AppText.purchaseUnavailable
            }
        } catch {
            statusMessage = AppText.purchaseUnavailable
        }
    }

    func restorePurchases() async {
        guard !isLoading else {
            return
        }

        isLoading = true
        statusMessage = nil
        defer { isLoading = false }

        do {
            try await AppStore.sync()
            acceptsFreshStoreKitTransactions = true
            await refreshEntitlements()
            statusMessage = isSupporter ? AppText.supportThanks : AppText.noPurchasesRestored
        } catch {
            statusMessage = AppText.purchaseUnavailable
        }
    }

    private func loadProducts() async {
        do {
            supporterProduct = try await loadSupporterProduct()
        } catch {
            supporterProduct = nil
        }
    }

    private func loadSupporterProduct() async throws -> Product {
        let products = try await Product.products(for: [Self.supporterProductID])
        guard let product = products.first else {
            throw StoreKitError.notAvailableInStorefront
        }

        return product
    }

    private func refreshEntitlements() async {
        var hasSupporterEntitlement = false

        for await result in Transaction.currentEntitlements {
            guard let transaction = try? checkVerified(result),
                  transaction.productID == Self.supporterProductID else {
                continue
            }

            hasSupporterEntitlement = true
            break
        }

        isSupporter = hasSupporterEntitlement
    }

    private func listenForTransactions() -> Task<Void, Never> {
        Task { [weak self] in
            for await result in Transaction.updates {
                guard let self,
                      let transaction = try? self.checkVerified(result) else {
                    continue
                }

                if transaction.productID == Self.supporterProductID {
                    guard !self.usesFreshStoreKitFlow || self.acceptsFreshStoreKitTransactions else {
                        await transaction.finish()
                        continue
                    }

                    self.isSupporter = true
                    self.thankYouDialogID += 1
                }

                await transaction.finish()
            }
        }
    }

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified:
            throw StoreKitError.unknown
        case .verified(let value):
            return value
        }
    }
}
