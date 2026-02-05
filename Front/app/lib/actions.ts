'use server';

// form data validation library
import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import { redirect } from 'next/navigation';

// Schema to match data against
// const FormSchema = z.object({
//     id: z.string(),
//     customerId: z.string({
//         invalid_type_error: 'Please select a customer.',
//     }),
//     amount: z.coerce.number()
//         .gt(0, { message: 'Please enter an amount greater than $0.' }),
//     status: z.enum(['pending', 'paid'], {
//         invalid_type_error: 'Please select an invoice status.',
//     }),
//     date: z.string(),
// });

// export type State = {
//     errors?: {
//         customerId?: string[];
//         amount?: string[];
//         status?: string[];
//     };
//     message?: string | null;
// };

// schema values which don't need to come from the user input
// const CreateInvoice = FormSchema.omit({id: true, date: true});
// const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    return "ok";
    // try {
    //     await signIn('credentials', formData);
    // } catch (error) {
    //     if (error instanceof AuthError) {
    //         switch (error.type) {
    //             case 'CredentialsSignin':
    //                 return 'Invalid credentials.';
    //             default:
    //                 return 'Something went wrong.';
    //         }
    //     }
    //     throw error;
    // }
}