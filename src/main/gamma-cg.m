#import <Foundation/Foundation.h>
#import <objc/message.h>
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>

int main(int argc, char *argv[]) {
    if (argc < 2) {
        fprintf(stderr, "Usage: gamma-cg <strength 0.0-1.0>\n");
        return 1;
    }
    float strength = (float)atof(argv[1]);

    void *handle = dlopen(
        "/System/Library/PrivateFrameworks/CoreBrightness.framework/CoreBrightness",
        RTLD_NOW);
    if (!handle) {
        fprintf(stderr, "Could not load CoreBrightness: %s\n", dlerror());
        return 1;
    }

    Class BlueLightClient = NSClassFromString(@"CBBlueLightClient");
    if (!BlueLightClient) {
        fprintf(stderr, "CBBlueLightClient class not found\n");
        return 1;
    }

    id client = [[BlueLightClient alloc] init];

    BOOL enable = (strength > 0.01f);

    SEL setSel = NSSelectorFromString(@"setEnabled:");
    if ([client respondsToSelector:setSel]) {
        ((void (*)(id, SEL, BOOL))objc_msgSend)(client, setSel, enable);
        printf("Night Shift enabled: %d\n", enable);
    } else {
        fprintf(stderr, "setEnabled: not available\n");
    }

    if (enable) {
        SEL strengthSel = NSSelectorFromString(@"setStrength:commit:");
        if ([client respondsToSelector:strengthSel]) {
            ((void (*)(id, SEL, float, BOOL))objc_msgSend)(client, strengthSel, strength, YES);
            printf("Night Shift strength: %.2f\n", strength);
        } else {
            fprintf(stderr, "setStrength:commit: not available\n");
        }
    }

    return 0;
}
