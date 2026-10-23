// LD_PRELOAD shim for running the NEAR sandbox node in containers with a low hard
// RLIMIT_NOFILE. neard asks for 65535 open files and exits if setrlimit fails; this clamps
// that request to the current hard limit instead. Test environments only.
#define _GNU_SOURCE
#include <dlfcn.h>
#include <sys/resource.h>

static struct rlimit clamp(const struct rlimit *want) {
    struct rlimit cur;
    struct rlimit out = *want;
    if (getrlimit(RLIMIT_NOFILE, &cur) == 0) {
        if (out.rlim_max > cur.rlim_max) out.rlim_max = cur.rlim_max;
        if (out.rlim_cur > out.rlim_max) out.rlim_cur = out.rlim_max;
    }
    return out;
}

int setrlimit(__rlimit_resource_t resource, const struct rlimit *rlim) {
    int (*real)(__rlimit_resource_t, const struct rlimit *) = dlsym(RTLD_NEXT, "setrlimit");
    if (resource == RLIMIT_NOFILE) {
        struct rlimit c = clamp(rlim);
        return real(resource, &c);
    }
    return real(resource, rlim);
}

int setrlimit64(__rlimit_resource_t resource, const struct rlimit64 *rlim) {
    int (*real)(__rlimit_resource_t, const struct rlimit64 *) = dlsym(RTLD_NEXT, "setrlimit64");
    if (resource == RLIMIT_NOFILE) {
        struct rlimit c = clamp((const struct rlimit *)rlim);
        return real(resource, (const struct rlimit64 *)&c);
    }
    return real(resource, rlim);
}
