// Local customization: preserve the application's existing privacy policy.
namespace VNotch.Services.LocalSend;

internal sealed class LocalSendPermission(NetworkPrivacy? privacy = null) : ILocalSendPermission
{
    public CancellationToken Acquire() => (privacy ?? NetworkPrivacy.Current).Acquire(NetworkFeature.LocalSend);
}
