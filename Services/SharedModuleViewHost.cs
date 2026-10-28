using VNotch.Contracts;

namespace VNotch.Services;

/// <summary>Secondary displays observe the primary host's running modules without owning their lifetime.</summary>
internal sealed class SharedModuleViewHost(IModuleLifecycleManager owner) : IModuleLifecycleManager
{
    public IReadOnlyCollection<INotchModule> Modules => owner.Modules;
    public void Register(INotchModule module) => throw new NotSupportedException("Register modules on the application host.");
    public void InitializeAll() => owner.InitializeAll();
    public void StartAll() => owner.StartAll();
    public void StopAll() { }
    public T? Get<T>() where T : class, INotchModule => owner.Get<T>();
    public void Dispose() { }
}
