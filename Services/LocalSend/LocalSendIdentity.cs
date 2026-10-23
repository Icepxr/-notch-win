// Local customization: per-dialog mutual-TLS identity, never installed as trusted.
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;

namespace VNotch.Services.LocalSend;

internal sealed class LocalSendIdentity : IDisposable
{
    private readonly RSA _key = RSA.Create(2048);
    internal X509Certificate2 Certificate { get; }
    internal string Fingerprint { get; }
    internal LocalSendIdentity()
    {
        var request = new CertificateRequest("CN=V-Notch LocalSend", _key, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        request.CertificateExtensions.Add(new X509BasicConstraintsExtension(false, false, 0, true));
        request.CertificateExtensions.Add(new X509KeyUsageExtension(X509KeyUsageFlags.DigitalSignature, true));
        request.CertificateExtensions.Add(new X509EnhancedKeyUsageExtension(new OidCollection { new("1.3.6.1.5.5.7.3.2") }, false));
        using var generated = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-5), DateTimeOffset.UtcNow.AddDays(30));
        byte[] pfx = generated.Export(X509ContentType.Pfx);
        // Windows Schannel requires a user-key handle rather than an ephemeral
        // RSA handle. No PersistKeySet flag and no certificate-store install.
        try { Certificate = new X509Certificate2(pfx, (string?)null, X509KeyStorageFlags.UserKeySet); }
        finally { CryptographicOperations.ZeroMemory(pfx); }
        Fingerprint = Certificate.GetCertHashString(HashAlgorithmName.SHA256);
    }
    public void Dispose() { Certificate.Dispose(); _key.Dispose(); }
}
