import Foundation
import StoreKit

@MainActor
final class SupportPurchaseManager: ObservableObject {
    static let supporterProductID = "ontrack.supporter_pack"

    @Published private(set) var supporterProduct: Product?
    @Published private(set) var isSupporter = false
    @Published private(set) var isLoading = false
    @Published private(set) var thankYouDialogID = 0
    @Published var statusMessage: String?

    private var updatesTask: Task<Void, Never>?

    deinit {
        updatesTask?.cancel()
    }

    func start() async {
        if updatesTask == nil {
            updatesTask = listenForTransactions()
        }

        await loadProducts()

#if DEBUG
        if ProcessInfo.processInfo.environment["ONTRACK_FRESH_STOREKIT_FLOW"] == "1" {
            isSupporter = false
            return
        }
#endif

        await refreshEntitlements()
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
