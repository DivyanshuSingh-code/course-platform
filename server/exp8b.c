/*Name: DIVYANSHU SINGH
  Div: A 
  Batch: A1 
  Roll No: 23*/ 

#include<stdio.h>
#include<string.h>
void main(){
    char str_arr[20][20],temp[20];
    int i=0,j=0,n;
    printf("\nEnter the size of string array: ");
    scanf("%d",&n);
    for(i=0;i<n;i++){
        printf("\nEnter the string: ");
        scanf("%s",str_arr[i]);
    }
    printf("\nString array elements are as follows:");
    for(i=0;i<n;i++){
        printf("\n%s",str_arr[i]);
    }
    for(i=0;i<n;i++){
        for(j=0;j<n;j++){
            if(strcmp(str_arr[i],str_arr[j]) < 0){
                strcpy(temp,str_arr[i]);
                strcpy(str_arr[i],str_arr[j]);
                strcpy(str_arr[j],temp);
            }
        }
    }
    printf("\nSorted string array elements are as follows: ");
    for(i=0;i<n;i++){
        printf("\n%s",str_arr[i]);
    }
}

apsit@apsit-HP-Pro-Tower-280-G9-PCI-Desktop-PC:~$ cd debucode 
apsit@apsit-HP-Pro-Tower-280-G9-PCI-Desktop-PC:~/debucode$ gcc EXP8b.c -o EXP8b
apsit@apsit-HP-Pro-Tower-280-G9-PCI-Desktop-PC:~/debucode$ ./EXP8b
Enter the size of string array: 4

Enter the string: mango

Enter the string: apple

Enter the string: orange

Enter the string: banana

String array elements are as follows:
mango
apple
orange
banana
Sorted string array elements are as follows: 
apple
banana
mango
orange
apsit@apsit-HP-Pro-Tower-280-G9-PCI-Desktop-PC:~/Apsit_Shaunok$